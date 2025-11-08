export type StubTransport = {
  sendMail: (options: unknown) => Promise<void> | void;
};

const createTransport = () => {
  const transport: StubTransport = {
    async sendMail() {
      // Tests stub out nodemailer behaviour; this default no-op keeps routes working.
    },
  };

  return transport;
};

export { createTransport };

export default { createTransport };
