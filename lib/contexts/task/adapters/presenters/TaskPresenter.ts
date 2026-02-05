/**
 * Task Presenter - Response formatting adapter
 *
 * Formats use case output DTOs for HTTP JSON responses.
 * Handles date formatting, field selection, and response shaping.
 */

/**
 * Generic task output DTO interface (will be refined with specific use case outputs in Step 4)
 */
interface TaskOutputDTO {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  createdAt: string;
  updatedAt?: string;
  [key: string]: unknown; // Allow additional fields from specific use cases
}

export class TaskPresenter {
  /**
   * Format single task for JSON response
   */
  static toJson(output: TaskOutputDTO): object {
    return {
      id: output.id,
      title: output.title,
      description: output.description,
      status: output.status,
      priority: output.priority,
      createdAt: output.createdAt,
      ...(output.updatedAt && { updatedAt: output.updatedAt }),
    };
  }

  /**
   * Format task list for JSON response
   */
  static toListJson(outputs: TaskOutputDTO[]): object {
    return {
      tasks: outputs.map((output) => this.toJson(output)),
      total: outputs.length,
    };
  }

  /**
   * Format detailed task view for JSON response
   */
  static toDetailedJson(output: TaskOutputDTO): object {
    return {
      ...this.toJson(output),
      // Additional fields for detailed view will be added based on specific use cases
    };
  }
}
