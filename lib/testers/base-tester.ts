import childProcess from "child_process";
import util from "util";
import { createWriteStream, WriteStream } from "fs";

class TestFailedError extends Error {
  constructor() {
    super("Test failed");
  }
}

class MultiWriter {
  targets: WriteStream[];

  constructor(...targets: WriteStream[]) {
    this.targets = targets;
  }

  write(...args: any[]): void {
    this.targets.map((t) => t.write(...args));
  }

  close(): void {
    this.targets.forEach((t) => t.close());
  }
}

class PrefixedLineWriter {
  prefix: string;
  target: WriteStream;
  lastChar: string;

  constructor(prefix: string, target: WriteStream) {
    this.prefix = prefix;
    this.target = target;
    this.lastChar = "\n";
  }

  write(msg: string): number {
    let bytesWritten = 0;
    [...msg].forEach((char) => {
      if (this.lastChar === "\n") {
        this.target.write(this.prefix);
      }
      bytesWritten += this.target.write(char);
      this.lastChar = char;
    });
    return bytesWritten;
  }

  close(): void {
    // No-op
  }
}

export default class BaseTester {
  // Returns true if the test passed, false if it failed
  async test(): Promise<boolean> {
    try {
      await this.doTest();
      return true;
    } catch (e) {
      if (e instanceof TestFailedError) {
        return false;
      }

      throw e;
    }
  }

  async doTest(): Promise<void> {
    throw new Error("Not implemented");
  }

  async assertStderrContains(command: string, expectedStderr: string, expectedExitCode = 0): Promise<void> {
    childProcess.execSync;
    const { stdout, stderr, exitCode } = await exec(command);

    console.log("");

    const stdoutStream = new Buffer("");
    const stderrStream = createWriteStream("stderr.txt");
    stdoutStream.write(stdout);
    stderrStream.write(stderr);

    if (exitCode !== expectedExitCode) {
      this.logError(`Process exited with code ${exitCode} (expected: ${expectedExitCode})`);
      throw new TestFailedError();
    }

    if (!stderr.includes(expectedStderr)) {
      this.logError(`Expected '${expectedStderr}' to be present.`);
      throw new TestFailedError();
    }
  }

  async assertStdoutContains(command: string, expectedStdout: string, expectedExitCode = 0): Promise<void> {
    const { stdout, stderr, code } = await exec(command);

    console.log("");

    const stdoutStream = createWriteStream("stdout.txt");
    const stderrStream = createWriteStream("stderr.txt");
    stdoutStream.write(stdout);
    stderrStream.write(stderr);

    if (code !== expectedExitCode) {
      this.logError(`Process exited with code ${code} (expected: ${expectedExitCode})`);
      throw new TestFailedError();
    }

    if (!stdout.includes(expectedStdout)) {
      this.logError(`Expected '${expectedStdout}' to be present.`);
      throw new TestFailedError();
    }
  }

  setupIoRelay(source: WriteStream, prefixedDestination: WriteStream, otherDestination: WriteStream): void {
    source.pipe(new MultiWriter(new PrefixedLineWriter("     ", prefixedDestination), otherDestination));
  }

  assert(condition: boolean, message: string): void {
    if (!condition) {
      this.logError(message);
      throw new TestFailedError();
    }
  }

  async assertTimeUnder(thresholdSeconds: number): Promise<number> {
    const before = Date.now();
    await this.doTest();
    const after = Date.now();
    const timeTaken = Math.round((after - before) / 1000);

    if (timeTaken > thresholdSeconds) {
      this.logError(`Measured time (${timeTaken}s) was above ${thresholdSeconds} seconds`);
      throw new TestFailedError();
    }

    return timeTaken;
  }
}