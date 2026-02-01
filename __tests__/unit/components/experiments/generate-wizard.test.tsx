/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GenerateWizardModal } from "@/components/experiments/generate-wizard-modal";

// Mock fetch
global.fetch = vi.fn();

describe("GenerateWizardModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    if (global.fetch && "mockClear" in global.fetch) {
      (
        global.fetch as unknown as { mockClear: () => void }
      ).mockClear();
    }
  });

  describe("Step 1: Test Area Selection", () => {
    it("should render test area selection cards", () => {
      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      expect(screen.getByText("Choose Test Area")).toBeInTheDocument();
      expect(screen.getByText("Brainstorming")).toBeInTheDocument();
      expect(screen.getByText("Planning")).toBeInTheDocument();
      expect(screen.getByText("Code Generation")).toBeInTheDocument();
      expect(screen.getByText("Model Parameters")).toBeInTheDocument();
    });

    it("should show step 1 of 4", () => {
      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    });

    it("should select test area on click", () => {
      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      const brainstormingCard = screen.getByText("Brainstorming").closest("button");
      expect(brainstormingCard).toBeInTheDocument();

      fireEvent.click(brainstormingCard!);

      expect(screen.getByText("Selected")).toBeInTheDocument();
    });

    it("should show error when trying to proceed without selection", () => {
      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      expect(screen.getByText("Please select a test area")).toBeInTheDocument();
    });

    it("should enable Next button when test area selected", () => {
      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).toBeDisabled();

      const brainstormingCard = screen.getByText("Brainstorming").closest("button");
      fireEvent.click(brainstormingCard!);

      expect(nextButton).not.toBeDisabled();
    });

    it("should close modal on close button click", () => {
      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Step 2: AI Questions", () => {
    beforeEach(() => {
      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      // Select brainstorming test area
      const brainstormingCard = screen.getByText("Brainstorming").closest("button");
      fireEvent.click(brainstormingCard!);

      // Click Next to go to step 2
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);
    });

    it("should render AI questions for brainstorming", () => {
      expect(screen.getByText("Answer a Few Questions")).toBeInTheDocument();
      expect(
        screen.getByText("Do you prioritize speed or thoroughness?"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Should the AI focus on technical details or business context?",
        ),
      ).toBeInTheDocument();
    });

    it("should show step 2 of 4", () => {
      expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    });

    it("should allow selecting answers via radio buttons", () => {
      const speedOption = screen.getByLabelText("Speed");
      fireEvent.click(speedOption);

      expect(speedOption).toBeChecked();
    });

    it("should show error when trying to proceed with unanswered questions", () => {
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      expect(screen.getByText("Please answer all questions")).toBeInTheDocument();
    });

    it("should enable Next button when all questions answered", () => {
      const speedOption = screen.getByLabelText("Speed");
      const technicalOption = screen.getByLabelText("Technical details");

      fireEvent.click(speedOption);
      fireEvent.click(technicalOption);

      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });

    it("should go back to step 1 when Back button clicked", () => {
      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      expect(screen.getByText("Choose Test Area")).toBeInTheDocument();
    });
  });

  describe("Step 3: Review Generated Config", () => {
    beforeEach(async () => {
      (
        global.fetch as unknown as { mockResolvedValueOnce: (value: unknown) => void }
      ).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          experiment: {
            id: "test-id",
            name: "Generated Experiment",
            description: "Test description",
            variants: [
              {
                name: "Variant A",
                weight: 33,
                config: {
                  type: "prompt",
                  promptOverrides: { system_prompt: "Test A" },
                },
              },
              {
                name: "Variant B",
                weight: 33,
                config: {
                  type: "prompt",
                  promptOverrides: { system_prompt: "Test B" },
                },
              },
              {
                name: "Variant C",
                weight: 34,
                config: {
                  type: "prompt",
                  promptOverrides: { system_prompt: "Test C" },
                },
              },
            ],
          },
        }),
      });

      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      // Navigate to step 2
      const brainstormingCard = screen.getByText("Brainstorming").closest("button");
      fireEvent.click(brainstormingCard!);
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      // Answer questions
      fireEvent.click(screen.getByLabelText("Speed"));
      fireEvent.click(screen.getByLabelText("Technical details"));

      // Click Next to generate
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      // Wait for API call to complete
      await waitFor(() => {
        expect(screen.getByText("Review Generated Variants")).toBeInTheDocument();
      });
    });

    it("should show generated variants", async () => {
      expect(screen.getByText("Variant A")).toBeInTheDocument();
      expect(screen.getByText("Variant B")).toBeInTheDocument();
      expect(screen.getByText("Variant C")).toBeInTheDocument();
    });

    it("should show variant weights", () => {
      expect(screen.getByText("33%")).toBeInTheDocument();
      expect(screen.getByText("34%")).toBeInTheDocument();
    });

    it("should show step 3 of 4", () => {
      expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    });

    it("should allow going back to step 2", () => {
      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      expect(screen.getByText("Answer a Few Questions")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should call generate API with correct payload", async () => {
      (
        global.fetch as unknown as { mockResolvedValueOnce: (value: unknown) => void }
      ).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          experiment: {
            id: "test-id",
            name: "Test",
            description: "Test",
            variants: [
              { name: "A", weight: 33, config: { type: "prompt" } },
              { name: "B", weight: 33, config: { type: "prompt" } },
              { name: "C", weight: 34, config: { type: "prompt" } },
            ],
          },
        }),
      });

      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      // Navigate through wizard
      fireEvent.click(screen.getByText("Brainstorming").closest("button")!);
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      fireEvent.click(screen.getByLabelText("Speed"));
      fireEvent.click(screen.getByLabelText("Technical details"));
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/experiments/generate",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: expect.stringContaining("brainstorming"),
          }),
        );
      });
    });

    it("should show error message on API failure", async () => {
      (
        global.fetch as unknown as { mockResolvedValueOnce: (value: unknown) => void }
      ).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: "Failed to generate experiment",
        }),
      });

      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      // Navigate through wizard
      fireEvent.click(screen.getByText("Brainstorming").closest("button")!);
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      fireEvent.click(screen.getByLabelText("Speed"));
      fireEvent.click(screen.getByLabelText("Technical details"));
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to generate experiment/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Progress Indicator", () => {
    it("should show progress bar at 25% on step 1", () => {
      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      const progressBar = document.querySelector('[style*="width: 25%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it("should update progress bar as steps advance", () => {
      render(
        <GenerateWizardModal onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );

      // Step 1 -> 25%
      expect(document.querySelector('[style*="width: 25%"]')).toBeInTheDocument();

      // Go to step 2
      fireEvent.click(screen.getByText("Brainstorming").closest("button")!);
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      // Step 2 -> 50%
      expect(document.querySelector('[style*="width: 50%"]')).toBeInTheDocument();
    });
  });
});
