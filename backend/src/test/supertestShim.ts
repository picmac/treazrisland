import type { FastifyInstance } from "fastify";

interface InjectResponse<T = unknown> {
  status: number;
  statusCode: number;
  body: T;
  headers: Record<string, string | string[]>;
  text: string;
  json: () => Promise<T>;
}

type RequestChain<T = unknown> = {
  set: (header: string, value: string) => RequestChain<T>;
  send: (payload: unknown) => RequestChain<T>;
  field: (name: string, value: string | number | boolean) => RequestChain<T>;
  attach: (
    name: string,
    data: Buffer | string,
    options?: { filename?: string; contentType?: string }
  ) => RequestChain<T>;
  then: <TResult = InjectResponse<T>, TError = unknown>(
    onFulfilled?: ((value: InjectResponse<T>) => TResult | Promise<TResult>) | null,
    onRejected?: ((reason: TError) => TResult | Promise<TResult>) | null
  ) => Promise<TResult>;
  catch: <TError = unknown>(
    onRejected?: ((reason: TError) => InjectResponse<T> | Promise<InjectResponse<T>>) | null
  ) => Promise<InjectResponse<T>>;
  expect: (status: number) => Promise<InjectResponse<T>>;
};

function buildResponse<T>(
  raw: Awaited<ReturnType<FastifyInstance["inject"]>>
): InjectResponse<T> {
  const headerValue = raw.headers["content-type"];
  const contentType = Array.isArray(headerValue)
    ? headerValue.join(";")
    : headerValue
      ? String(headerValue)
      : "";

  const bodyValue = raw.body as unknown;
  const text = (() => {
    if (typeof bodyValue === "string") {
      return bodyValue;
    }
    if (Buffer.isBuffer(bodyValue)) {
      return bodyValue.toString("utf8");
    }
    if (bodyValue === undefined || bodyValue === null) {
      return "";
    }
    if (typeof bodyValue === "object") {
      try {
        return JSON.stringify(bodyValue);
      } catch {
        return String(bodyValue);
      }
    }
    return String(bodyValue);
  })();

  let parsed: unknown = bodyValue;
  if (contentType.includes("application/json")) {
    if (text.length === 0) {
      parsed = null;
    } else {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
  }

  const headers: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(raw.headers)) {
    if (Array.isArray(value)) {
      headers[key] = value;
    } else if (typeof value === "string" || typeof value === "number") {
      headers[key] = value.toString();
    }
  }

  return {
    status: raw.statusCode,
    statusCode: raw.statusCode,
    body: parsed as T,
    headers,
    text,
    json: async () => parsed as T
  };
}

type AllowedMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

type MultipartField = { name: string; value: string };
type MultipartFile = {
  name: string;
  data: Buffer;
  filename: string;
  contentType: string;
};

function createChain<T>(
  app: FastifyInstance,
  method: AllowedMethod,
  url: string,
  options: {
    headers: Record<string, string | string[]>;
    payload?: string | Buffer;
    fields: MultipartField[];
    files: MultipartFile[];
  }
): RequestChain<T> {
  const execute = async (): Promise<InjectResponse<T>> => {
    let payloadToSend: string | Buffer | undefined = options.payload;

    if (options.files.length > 0 || options.fields.length > 0) {
      const boundary = `--------------------------${Date.now().toString(16)}${Math.random()
        .toString(16)
        .slice(2)}`;
      const parts: Buffer[] = [];

      for (const field of options.fields) {
        parts.push(
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`
          )
        );
      }

      for (const file of options.files) {
        parts.push(
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
          )
        );
        parts.push(file.data);
        parts.push(Buffer.from("\r\n"));
      }

      parts.push(Buffer.from(`--${boundary}--\r\n`));

      payloadToSend = Buffer.concat(parts);
      options.headers["content-type"] = `multipart/form-data; boundary=${boundary}`;
    }

    const response = (await app.inject({
      method,
      url,
      headers: options.headers,
      payload: payloadToSend
    })) as Awaited<ReturnType<FastifyInstance["inject"]>>;
    return buildResponse<T>(response);
  };

  const chain: RequestChain<T> = {
    set(header, value) {
      const key = header.toLowerCase();
      const existing = options.headers[key];
      if (key === "cookie") {
        const current = Array.isArray(existing) ? existing.join("; ") : existing ?? "";
        options.headers[key] = current ? `${current}; ${value}` : value;
        return chain;
      }

      if (existing !== undefined) {
        options.headers[key] = Array.isArray(existing)
          ? [...existing, value]
          : [existing as string, value];
      } else {
        options.headers[key] = value;
      }
      return chain;
    },
    send(payload) {
      if (payload && typeof payload === "object" && !Buffer.isBuffer(payload)) {
        options.payload = JSON.stringify(payload);
        if (!options.headers["content-type"]) {
          options.headers["content-type"] = "application/json";
        }
      } else if (typeof payload === "number" || typeof payload === "boolean") {
        options.payload = String(payload);
      } else {
        options.payload = payload as string | Buffer | undefined;
      }
      return chain;
    },
    field(name, value) {
      options.fields.push({ name, value: String(value) });
      return chain;
    },
    attach(name, data, opts) {
      options.files.push({
        name,
        data: Buffer.isBuffer(data) ? data : Buffer.from(data),
        filename: opts?.filename ?? "file",
        contentType: opts?.contentType ?? "application/octet-stream"
      });
      return chain;
    },
    then(onFulfilled, onRejected) {
      return execute().then(onFulfilled as never, onRejected as never);
    },
    catch(onRejected) {
      return execute().catch(onRejected as never);
    },
    async expect(status) {
      const response = await execute();
      if (response.status !== status) {
        throw new Error(`Expected status ${status} but received ${response.status}`);
      }
      return response;
    }
  };

  return chain;
}

export default function request(app: FastifyInstance) {
  return {
    get<T = unknown>(url: string): RequestChain<T> {
      return createChain<T>(app, "GET", url, {
        headers: {},
        payload: undefined,
        fields: [],
        files: []
      });
    },
    post<T = unknown>(url: string): RequestChain<T> {
      return createChain<T>(app, "POST", url, {
        headers: {},
        payload: undefined,
        fields: [],
        files: []
      });
    },
    patch<T = unknown>(url: string): RequestChain<T> {
      return createChain<T>(app, "PATCH", url, {
        headers: {},
        payload: undefined,
        fields: [],
        files: []
      });
    }
  };
}
