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
  then: <TResult = InjectResponse<T>, TError = unknown>(
    onFulfilled?: ((value: InjectResponse<T>) => TResult | Promise<TResult>) | null,
    onRejected?: ((reason: TError) => TResult | Promise<TResult>) | null
  ) => Promise<TResult>;
  catch: <TError = unknown>(
    onRejected?: ((reason: TError) => InjectResponse<T> | Promise<InjectResponse<T>>) | null
  ) => Promise<InjectResponse<T>>;
  expect: (status: number) => Promise<InjectResponse<T>>;
};

function buildResponse(raw: Awaited<ReturnType<FastifyInstance["inject"]>>): InjectResponse {
  const contentType = (raw.headers["content-type"] ?? "").toString();
  let parsed: unknown = raw.body;
  if (contentType.includes("application/json")) {
    try {
      parsed = typeof raw.json === "function" ? raw.json() : raw.body;
    } catch {
      if (typeof raw.body === "string") {
        parsed = raw.body.length > 0 ? JSON.parse(raw.body) : null;
      } else if (Buffer.isBuffer(raw.body)) {
        const text = raw.body.toString("utf8");
        parsed = text.length > 0 ? JSON.parse(text) : null;
      }
    }
  }

  const text = (() => {
    if (typeof raw.body === "string") {
      return raw.body;
    }
    if (Buffer.isBuffer(raw.body)) {
      return raw.body.toString("utf8");
    }
    if (raw.body === undefined || raw.body === null) {
      return "";
    }
    return JSON.stringify(raw.body);
  })();

  return {
    status: raw.statusCode,
    statusCode: raw.statusCode,
    body: parsed as T,
    headers: raw.headers as Record<string, string | string[]>,
    text,
    json: async () => parsed as T
  };
}

function createChain<T>(
  app: FastifyInstance,
  method: string,
  url: string,
  options: { headers: Record<string, string | string[]>; payload: unknown }
): RequestChain<T> {
  const execute = async (): Promise<InjectResponse<T>> => {
    const response = await app.inject({
      method,
      url,
      headers: options.headers,
      payload: options.payload
    });
    return buildResponse(response) as InjectResponse<T>;
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
      if (payload && typeof payload === "object" && !(payload instanceof Buffer)) {
        options.payload = JSON.stringify(payload);
        if (!options.headers["content-type"]) {
          options.headers["content-type"] = "application/json";
        }
      } else {
        options.payload = payload;
      }
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
      return createChain<T>(app, "GET", url, { headers: {}, payload: undefined });
    },
    post<T = unknown>(url: string): RequestChain<T> {
      return createChain<T>(app, "POST", url, { headers: {}, payload: undefined });
    }
  };
}
