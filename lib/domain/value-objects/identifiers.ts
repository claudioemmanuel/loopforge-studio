export class TaskId {
  constructor(public readonly value: string) {
    if (!value) {
      throw new Error("TaskId cannot be empty");
    }
  }
}

export class ExecutionId {
  constructor(public readonly value: string) {
    if (!value) {
      throw new Error("ExecutionId cannot be empty");
    }
  }
}

export class RepoId {
  constructor(public readonly value: string) {
    if (!value) {
      throw new Error("RepoId cannot be empty");
    }
  }
}

export class SubscriptionId {
  constructor(public readonly value: string) {
    if (!value) {
      throw new Error("SubscriptionId cannot be empty");
    }
  }
}
