import readline from 'node:readline';
import type { WriteStream } from 'node:tty';

type QuestionOptions = {
  hidden?: boolean;
};

type MutableInterface = readline.Interface & {
  stdoutMuted?: boolean;
  _writeToOutput?: (stringToWrite: string) => void;
};

export class Prompt {
  private readonly rl: MutableInterface;
  private readonly output: WriteStream;

  constructor() {
    this.output = process.stdout as WriteStream;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: this.output,
      terminal: true,
    }) as MutableInterface;

    this.rl.on('SIGINT', () => {
      this.close();
      this.output.write('\nAborted by user.\n');
      process.exit(1);
    });
  }

  ask(question: string, options?: QuestionOptions): Promise<string> {
    return new Promise((resolve) => {
      if (options?.hidden) {
        const originalWriter = this.rl._writeToOutput?.bind(this.rl);
        this.rl.stdoutMuted = true;
        this.rl._writeToOutput = (stringToWrite: string) => {
          if (this.rl.stdoutMuted) {
            this.output.write('*');
          } else if (originalWriter) {
            originalWriter(stringToWrite);
          } else {
            this.output.write(stringToWrite);
          }
        };

        this.rl.question(question, (answer) => {
          this.rl.stdoutMuted = false;
          if (originalWriter) {
            this.rl._writeToOutput = originalWriter;
          } else {
            delete this.rl._writeToOutput;
          }

          this.output.write('\n');
          resolve(answer.trim());
        });

        return;
      }

      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  close(): void {
    this.rl.close();
  }
}
