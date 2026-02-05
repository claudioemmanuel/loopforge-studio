/**
 * TaskMetadata value object - Core task information
 */
export interface TaskMetadata {
  title: string;
  description: string;
  priority: number;
}

export function validateTaskMetadata(data: {
  title: string;
  description: string;
  priority?: number;
}): TaskMetadata {
  if (!data.title || data.title.trim() === "") {
    throw new Error("Title is required");
  }

  if (data.title.length > 200) {
    throw new Error("Title must be less than 200 characters");
  }

  const priority = data.priority ?? 0;
  if (priority < 0 || priority > 10) {
    throw new Error("Priority must be between 0 and 10");
  }

  return {
    title: data.title.trim(),
    description: data.description.trim(),
    priority,
  };
}
