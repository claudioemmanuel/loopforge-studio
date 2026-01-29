-- Migration: Add A/B testing framework for prompt optimization
-- Created: 2026-01-29
-- Purpose: Enable systematic prompt experimentation with statistical analysis

-- Experiments table - defines A/B tests
CREATE TABLE experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft', -- draft, active, paused, completed
  traffic_allocation DECIMAL(3,2) DEFAULT 0.10, -- Percentage of traffic (0.10 = 10%)
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE experiments IS
'A/B test experiments for prompt optimization. Each experiment tests multiple variants.';

COMMENT ON COLUMN experiments.traffic_allocation IS
'Percentage of traffic to include in experiment (0.10 = 10%, 1.00 = 100%)';

-- Experiment variants - different prompt/model/parameter configurations
CREATE TABLE experiment_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  weight DECIMAL(3,2) DEFAULT 0.50, -- Relative weight for assignment (0.50 = 50%)
  config JSONB NOT NULL, -- Variant configuration (prompt changes, model, parameters)
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(experiment_id, name)
);

COMMENT ON TABLE experiment_variants IS
'Variants within an experiment (e.g., control vs treatment). Config contains prompt/model overrides.';

COMMENT ON COLUMN experiment_variants.weight IS
'Relative weight for variant assignment. Must sum to 1.0 across all variants in experiment.';

-- Variant assignments - which tasks got which variant
CREATE TABLE variant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES experiment_variants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(experiment_id, task_id) -- One assignment per task per experiment
);

COMMENT ON TABLE variant_assignments IS
'Records which variant was assigned to each task. Enables deterministic assignment.';

-- Experiment metrics - captured outcomes for statistical analysis
CREATE TABLE experiment_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_assignment_id UUID REFERENCES variant_assignments(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  metadata JSONB, -- Additional context (e.g., model used, iteration count)
  recorded_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE experiment_metrics IS
'Metrics captured for each variant assignment (e.g., task_success, iterations_count, token_count).';

-- Indices for performance
CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_dates ON experiments(start_date, end_date);
CREATE INDEX idx_variant_assignments_experiment ON variant_assignments(experiment_id);
CREATE INDEX idx_variant_assignments_task ON variant_assignments(task_id);
CREATE INDEX idx_variant_assignments_user ON variant_assignments(user_id);
CREATE INDEX idx_experiment_metrics_assignment ON experiment_metrics(variant_assignment_id);
CREATE INDEX idx_experiment_metrics_name ON experiment_metrics(metric_name);
