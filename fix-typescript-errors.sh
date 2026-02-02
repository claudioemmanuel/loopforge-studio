#!/bin/bash
# Script to fix TypeScript errors in execution-service.ts

FILE="lib/contexts/execution/application/execution-service.ts"

# Backup the file
cp "$FILE" "$FILE.backup"

# Add imports after the existing imports
sed -i.tmp '19a\
import type { AIClient } from "@/lib/ai/client";\
import type { ParallelExecutionOptions } from "@/lib/agents/types";\
import type { ExecutionEvent } from "@/lib/ralph/types";
' "$FILE"

# Fix aiClient: any
sed -i.tmp 's/aiClient: any;/aiClient: AIClient;/g' "$FILE"

# Fix parallelOptions?: any
sed -i.tmp 's/parallelOptions?: any;/parallelOptions?: Partial<ParallelExecutionOptions>;/g' "$FILE"

# Fix onEvent?: (event: any)
sed -i.tmp 's/onEvent?: (event: any)/onEvent?: (event: ExecutionEvent)/g' "$FILE"

# Fix onProgress?: (event: any)
sed -i.tmp 's/onProgress?: (event: any)/onProgress?: (event: ExecutionEvent)/g' "$FILE"

# Fix stuckSignals?: any[]
sed -i.tmp 's/stuckSignals?: any\[\];/stuckSignals?: StuckSignal[];/g' "$FILE"

# Fix validationReport?: any
sed -i.tmp 's/validationReport?: any;/validationReport?: ValidationReport;/g' "$FILE"

# Fix const emitEvent = async (event: any)
sed -i.tmp 's/const emitEvent = async (event: any)/const emitEvent = async (event: ExecutionEvent)/g' "$FILE"

# Fix result: result.status as any
sed -i.tmp 's/result: result\.status as any/result: result.status as "complete" | "stuck" | "continue"/g' "$FILE"

# Fix method: extraction.method as any
sed -i.tmp 's/method: extraction\.method as any/method: extraction.method/g' "$FILE"

# Fix f: any type hints in map functions
sed -i.tmp 's/\.map((f: any) =>/\.map((f: { path: string; content: string; action?: string }) =>/g' "$FILE"

# Fix e: any in error map
sed -i.tmp 's/\.map((e: any) =>/\.map((e: { path: string; error: string }) =>/g' "$FILE"

# Fix type: signal.type as any
sed -i.tmp 's/type: signal\.type as any/type: signal.type/g' "$FILE"

# Fix severity: signal.severity as any
sed -i.tmp 's/severity: signal\.severity as any/severity: signal.severity/g' "$FILE"

# Clean up temp files
rm -f "$FILE.tmp"

echo "TypeScript errors fixed in $FILE"
echo "Backup saved as $FILE.backup"
