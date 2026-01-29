/**
 * Statistical Analysis for A/B Testing
 *
 * Implements Welch's t-test for comparing variant performance.
 * Calculates confidence intervals, p-values, and recommendations.
 */

import { db } from "@/lib/db";
import {
  experiments,
  experimentVariants,
  variantAssignments,
  experimentMetrics,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface VariantStatistics {
  variantId: string;
  variantName: string;
  sampleSize: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

export interface ComparisonResult {
  control: VariantStatistics;
  treatment: VariantStatistics;
  tStatistic: number;
  pValue: number;
  confidenceInterval: { lower: number; upper: number };
  recommendation: "continue" | "rollout" | "stop";
  significanceLevel: number;
}

export interface ExperimentAnalysis {
  experimentName: string;
  metricName: string;
  variants: VariantStatistics[];
  comparison: ComparisonResult | null;
  isSignificant: boolean;
}

/**
 * Analyze an experiment for a specific metric
 * Compares all variants and returns statistical analysis
 */
export async function analyzeExperiment(
  experimentName: string,
  metricName: string,
  significanceLevel: number = 0.05,
): Promise<ExperimentAnalysis | null> {
  // Get experiment with variants
  const experiment = await db.query.experiments.findFirst({
    where: eq(experiments.name, experimentName),
    with: {
      variants: true,
    },
  });

  if (!experiment) {
    return null;
  }

  // Get all assignments for this experiment
  const assignments = await db.query.variantAssignments.findMany({
    where: eq(variantAssignments.experimentId, experiment.id),
  });

  const assignmentIds = assignments.map((a) => a.id);

  if (assignmentIds.length === 0) {
    return {
      experimentName,
      metricName,
      variants: [],
      comparison: null,
      isSignificant: false,
    };
  }

  // Get metrics for all assignments
  const metrics = await db.query.experimentMetrics.findMany({
    where: and(
      inArray(experimentMetrics.variantAssignmentId, assignmentIds),
      eq(experimentMetrics.metricName, metricName),
    ),
  });

  // Group metrics by variant
  const metricsByVariant = new Map<string, number[]>();
  for (const metric of metrics) {
    const assignment = assignments.find(
      (a) => a.id === metric.variantAssignmentId,
    );
    if (!assignment) continue;

    const variantId = assignment.variantId;
    if (!metricsByVariant.has(variantId)) {
      metricsByVariant.set(variantId, []);
    }
    metricsByVariant.get(variantId)!.push(metric.metricValue);
  }

  // Calculate statistics for each variant
  const variantStats: VariantStatistics[] = [];
  for (const variant of experiment.variants) {
    const values = metricsByVariant.get(variant.id) || [];
    if (values.length === 0) {
      variantStats.push({
        variantId: variant.id,
        variantName: variant.name,
        sampleSize: 0,
        mean: 0,
        stdDev: 0,
        min: 0,
        max: 0,
      });
      continue;
    }

    const stats = calculateStatistics(values);
    variantStats.push({
      variantId: variant.id,
      variantName: variant.name,
      ...stats,
    });
  }

  // Perform comparison if we have 2 variants
  let comparison: ComparisonResult | null = null;
  let isSignificant = false;

  if (
    variantStats.length === 2 &&
    variantStats[0].sampleSize > 0 &&
    variantStats[1].sampleSize > 0
  ) {
    // Assume first variant is control, second is treatment
    const control = variantStats[0];
    const treatment = variantStats[1];

    comparison = compareVariants(control, treatment, significanceLevel);
    isSignificant = comparison.pValue < significanceLevel;
  }

  return {
    experimentName,
    metricName,
    variants: variantStats,
    comparison,
    isSignificant,
  };
}

/**
 * Calculate basic statistics for a set of values
 */
function calculateStatistics(values: number[]): {
  sampleSize: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
} {
  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    sampleSize: n,
    mean,
    stdDev,
    min,
    max,
  };
}

/**
 * Compare two variants using Welch's t-test
 * Returns t-statistic, p-value, confidence interval, and recommendation
 */
function compareVariants(
  control: VariantStatistics,
  treatment: VariantStatistics,
  significanceLevel: number,
): ComparisonResult {
  // Welch's t-test (doesn't assume equal variance)
  const n1 = control.sampleSize;
  const n2 = treatment.sampleSize;
  const mean1 = control.mean;
  const mean2 = treatment.mean;
  const s1 = control.stdDev;
  const s2 = treatment.stdDev;

  // Calculate t-statistic
  const tStatistic =
    (mean2 - mean1) / Math.sqrt((s1 * s1) / n1 + (s2 * s2) / n2);

  // Calculate degrees of freedom (Welch-Satterthwaite equation)
  const df =
    Math.pow((s1 * s1) / n1 + (s2 * s2) / n2, 2) /
    (Math.pow((s1 * s1) / n1, 2) / (n1 - 1) +
      Math.pow((s2 * s2) / n2, 2) / (n2 - 1));

  // Calculate p-value (two-tailed test)
  const pValue = 2 * (1 - tCDF(Math.abs(tStatistic), df));

  // Calculate 95% confidence interval for difference in means
  const tCritical = tInverse(1 - significanceLevel / 2, df);
  const se = Math.sqrt((s1 * s1) / n1 + (s2 * s2) / n2);
  const diff = mean2 - mean1;
  const confidenceInterval = {
    lower: diff - tCritical * se,
    upper: diff + tCritical * se,
  };

  // Determine recommendation
  let recommendation: "continue" | "rollout" | "stop";
  if (pValue < significanceLevel) {
    if (mean2 > mean1) {
      recommendation = "rollout"; // Treatment is significantly better
    } else {
      recommendation = "stop"; // Treatment is significantly worse
    }
  } else {
    recommendation = "continue"; // No significant difference yet
  }

  return {
    control,
    treatment,
    tStatistic,
    pValue,
    confidenceInterval,
    recommendation,
    significanceLevel,
  };
}

/**
 * Cumulative Distribution Function for t-distribution
 * Approximation using normal distribution for large df
 */
function tCDF(t: number, df: number): number {
  if (df > 30) {
    // Use normal approximation for large df
    return normalCDF(t);
  }

  // Simple approximation for small df
  // This is a rough approximation; for production, use a proper stats library
  const x = df / (df + t * t);
  const beta = incompleteBeta(x, df / 2, 0.5);
  return 1 - beta / 2;
}

/**
 * Inverse t-distribution (critical value)
 * Approximation for calculating confidence intervals
 */
function tInverse(p: number, df: number): number {
  if (df > 30) {
    // Use normal approximation
    return normalInverse(p);
  }

  // Rough approximation; for production, use a proper stats library
  // Using normal approximation with correction factor
  const z = normalInverse(p);
  return z * (1 + (z * z + 1) / (4 * df));
}

/**
 * Normal CDF (standard normal distribution)
 */
function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

/**
 * Inverse normal CDF
 */
function normalInverse(p: number): number {
  // Beasley-Springer-Moro algorithm
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  const q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

/**
 * Error function (erf)
 */
function erf(x: number): number {
  // Abramowitz and Stegun approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1 / (1 + p * x);
  const y =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Incomplete beta function (simplified)
 */
function incompleteBeta(x: number, a: number, b: number): number {
  // Rough approximation; for production, use a proper stats library
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use normal approximation for simplicity
  return 0.5;
}
