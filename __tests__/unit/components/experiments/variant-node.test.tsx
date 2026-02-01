/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariantNode } from "@/components/experiments/variant-node";

describe("VariantNode", () => {
  describe("Rendering", () => {
    it("should render variant name and weight", () => {
      render(
        <VariantNode
          name="Test Variant"
          weight={33}
          status="draft"
        />,
      );

      expect(screen.getByText("Test Variant")).toBeInTheDocument();
      expect(screen.getByText("33% weight")).toBeInTheDocument();
    });

    it("should render with control label", () => {
      render(
        <VariantNode
          name="Control Variant"
          weight={33}
          status="control"
        />,
      );

      expect(screen.getByText("Control Variant")).toBeInTheDocument();
    });

    it("should render sample size when provided", () => {
      render(
        <VariantNode
          name="Test Variant"
          weight={33}
          status="running"
          sampleSize={42}
        />,
      );

      expect(screen.getByText(/42 tasks/)).toBeInTheDocument();
    });
  });

  describe("Status-based Styling", () => {
    it("should render winning status with trophy icon", () => {
      render(
        <VariantNode
          name="Winning Variant"
          weight={33}
          status="winning"
        />,
      );

      expect(screen.getByText("Winner")).toBeInTheDocument();
      // Trophy icon should be present
      const trophy = document.querySelector('svg[class*="lucide-trophy"]');
      expect(trophy).toBeInTheDocument();
    });

    it("should render losing status badge", () => {
      render(
        <VariantNode
          name="Losing Variant"
          weight={33}
          status="losing"
        />,
      );

      expect(screen.getByText("Losing")).toBeInTheDocument();
    });

    it("should render running status badge", () => {
      render(
        <VariantNode
          name="Running Variant"
          weight={33}
          status="running"
        />,
      );

      expect(screen.getByText("Running")).toBeInTheDocument();
    });

    it("should not show status badge for draft", () => {
      render(
        <VariantNode
          name="Draft Variant"
          weight={33}
          status="draft"
        />,
      );

      expect(screen.queryByText("Running")).not.toBeInTheDocument();
      expect(screen.queryByText("Winner")).not.toBeInTheDocument();
      expect(screen.queryByText("Losing")).not.toBeInTheDocument();
    });

    it("should not show status badge for control", () => {
      render(
        <VariantNode
          name="Control Variant"
          weight={33}
          status="control"
        />,
      );

      expect(screen.queryByText("Running")).not.toBeInTheDocument();
      expect(screen.queryByText("Winner")).not.toBeInTheDocument();
      expect(screen.queryByText("Losing")).not.toBeInTheDocument();
    });
  });

  describe("Metrics Display", () => {
    it("should render primary metric", () => {
      render(
        <VariantNode
          name="Test Variant"
          weight={33}
          status="winning"
          primaryMetric={{
            label: "Success Rate",
            value: "95%",
          }}
        />,
      );

      expect(screen.getByText("Success Rate")).toBeInTheDocument();
      expect(screen.getByText("95%")).toBeInTheDocument();
    });

    it("should render primary metric with positive change indicator", () => {
      render(
        <VariantNode
          name="Test Variant"
          weight={33}
          status="winning"
          primaryMetric={{
            label: "Success Rate",
            value: "95%",
            change: 15,
          }}
        />,
      );

      expect(screen.getByText("15%")).toBeInTheDocument();
      // Should have TrendingUp icon
      const trendingUp = document.querySelector('svg[class*="lucide-trending-up"]');
      expect(trendingUp).toBeInTheDocument();
    });

    it("should render primary metric with negative change indicator", () => {
      render(
        <VariantNode
          name="Test Variant"
          weight={33}
          status="losing"
          primaryMetric={{
            label: "Success Rate",
            value: "75%",
            change: -10,
          }}
        />,
      );

      expect(screen.getByText("10%")).toBeInTheDocument();
      // Should have TrendingDown icon
      const trendingDown = document.querySelector('svg[class*="lucide-trending-down"]');
      expect(trendingDown).toBeInTheDocument();
    });

    it("should render secondary metrics", () => {
      render(
        <VariantNode
          name="Test Variant"
          weight={33}
          status="running"
          secondaryMetrics={[
            { label: "Avg Duration", value: "45s" },
            { label: "Error Rate", value: "2%" },
          ]}
        />,
      );

      expect(screen.getByText("Avg Duration")).toBeInTheDocument();
      expect(screen.getByText("45s")).toBeInTheDocument();
      expect(screen.getByText("Error Rate")).toBeInTheDocument();
      expect(screen.getByText("2%")).toBeInTheDocument();
    });
  });

  describe("Statistical Significance", () => {
    it("should render confidence level badge", () => {
      render(
        <VariantNode
          name="Test Variant"
          weight={33}
          status="winning"
          confidenceLevel={95}
          pValue={0.03}
        />,
      );

      expect(screen.getByText("95% confident ✓")).toBeInTheDocument();
    });

    it("should show checkmark only when p-value < 0.05", () => {
      const { rerender } = render(
        <VariantNode
          name="Test Variant"
          weight={33}
          status="running"
          confidenceLevel={90}
          pValue={0.1}
        />,
      );

      expect(screen.getByText("90% confident")).toBeInTheDocument();
      expect(screen.queryByText("✓")).not.toBeInTheDocument();

      rerender(
        <VariantNode
          name="Test Variant"
          weight={33}
          status="winning"
          confidenceLevel={95}
          pValue={0.02}
        />,
      );

      expect(screen.getByText("95% confident ✓")).toBeInTheDocument();
    });
  });

  describe("Click Handling", () => {
    it("should call onClick when clicked", () => {
      const handleClick = vi.fn();

      render(
        <VariantNode
          name="Test Variant"
          weight={33}
          status="running"
          onClick={handleClick}
        />,
      );

      const card = screen.getByText("Test Variant").closest("div[class*='cursor-pointer']");
      fireEvent.click(card!.parentElement!);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should not be clickable when onClick not provided", () => {
      render(
        <VariantNode
          name="Test Variant"
          weight={33}
          status="running"
        />,
      );

      const card = screen.getByText("Test Variant").closest("div");
      expect(card?.className).not.toContain("cursor-pointer");
    });
  });

  describe("Visual Styling", () => {
    it("should apply emerald colors for winning status", () => {
      const { container } = render(
        <VariantNode
          name="Winning Variant"
          weight={33}
          status="winning"
          primaryMetric={{
            label: "Success Rate",
            value: "95%",
          }}
        />,
      );

      // Check for emerald border class
      const card = container.querySelector('[class*="border-emerald"]');
      expect(card).toBeInTheDocument();
    });

    it("should apply red colors for losing status", () => {
      const { container } = render(
        <VariantNode
          name="Losing Variant"
          weight={33}
          status="losing"
          primaryMetric={{
            label: "Success Rate",
            value: "70%",
          }}
        />,
      );

      // Check for red border class
      const card = container.querySelector('[class*="border-red"]');
      expect(card).toBeInTheDocument();
    });

    it("should apply dashed border for draft status", () => {
      const { container } = render(
        <VariantNode
          name="Draft Variant"
          weight={33}
          status="draft"
        />,
      );

      // Check for dashed border
      const card = container.querySelector('[class*="border-dashed"]');
      expect(card).toBeInTheDocument();
    });
  });
});
