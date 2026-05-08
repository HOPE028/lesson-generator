import ts from "typescript";

import {
  generatedLessonSchema,
  type GeneratedLesson,
} from "@/lib/lessons/schema";

export type LessonValidationResult = {
  lesson: GeneratedLesson;
  normalizedSource: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isSatisfiesExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }

  return expression;
}

function propertyNameToString(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  throw new Error("Only static object keys are allowed in generated lessons.");
}

function expressionToJson(expression: ts.Expression): JsonValue {
  const unwrapped = unwrapExpression(expression);

  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }

  if (ts.isNumericLiteral(unwrapped)) {
    return Number(unwrapped.text);
  }

  if (unwrapped.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (unwrapped.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (unwrapped.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }

  if (
    ts.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(unwrapped.operand)
  ) {
    return -Number(unwrapped.operand.text);
  }

  if (ts.isArrayLiteralExpression(unwrapped)) {
    return unwrapped.elements.map((item) => expressionToJson(item));
  }

  if (ts.isObjectLiteralExpression(unwrapped)) {
    const result: Record<string, JsonValue> = {};

    for (const property of unwrapped.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error("Generated lessons may only use simple property assignments.");
      }

      result[propertyNameToString(property.name)] = expressionToJson(
        property.initializer,
      );
    }

    return result;
  }

  throw new Error("Generated lessons may only contain JSON-compatible values.");
}

function findDefaultExport(sourceFile: ts.SourceFile): ts.Expression {
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      return statement.expression;
    }
  }

  throw new Error("Generated TypeScript must default-export the lesson object.");
}

function assertNoUnsafeNodes(sourceFile: ts.SourceFile) {
  const unsafeKinds = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.CallExpression,
    ts.SyntaxKind.NewExpression,
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.ArrowFunction,
    ts.SyntaxKind.ImportDeclaration,
    ts.SyntaxKind.ImportEqualsDeclaration,
    ts.SyntaxKind.VariableStatement,
    ts.SyntaxKind.ClassDeclaration,
    ts.SyntaxKind.AwaitExpression,
  ]);

  function visit(node: ts.Node) {
    if (unsafeKinds.has(node.kind)) {
      throw new Error(`Unsafe TypeScript node rejected: ${ts.SyntaxKind[node.kind]}`);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

export function validateGeneratedLessonSource(
  source: string,
): LessonValidationResult {
  const sourceFile = ts.createSourceFile(
    "generated-lesson.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const syntaxErrors = (
    sourceFile as ts.SourceFile & {
      parseDiagnostics: readonly ts.DiagnosticWithLocation[];
    }
  ).parseDiagnostics;
  if (syntaxErrors.length > 0) {
    throw new Error(
      syntaxErrors
        .map((error) => error.messageText.toString())
        .join("; "),
    );
  }

  assertNoUnsafeNodes(sourceFile);

  const exportedExpression = findDefaultExport(sourceFile);
  const lesson = generatedLessonSchema.parse(expressionToJson(exportedExpression));
  const normalizedSource = `import type { GeneratedLesson } from "@/lib/lessons/schema";

export default ${JSON.stringify(lesson, null, 2)} satisfies GeneratedLesson;
`;

  return { lesson, normalizedSource };
}
