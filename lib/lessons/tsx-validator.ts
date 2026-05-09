import ts from "typescript";
import { z } from "zod";

import {
  lessonRenderNodeSchema,
  multipleChoiceQuestionSchema,
  type LessonPlan,
  type LessonRenderNode,
  type RenderPropValue,
} from "@/lib/lessons/schema";

const APPROVED_RUNTIME_MODULE = "@/components/lessons/generated-lesson-runtime";

const ALLOWED_INTRINSIC_ELEMENTS = new Set([
  "article",
  "aside",
  "blockquote",
  "div",
  "em",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "header",
  "li",
  "main",
  "ol",
  "p",
  "section",
  "span",
  "strong",
  "ul",
]);

const ALLOWED_COMPONENTS = new Set(["GeneratedImage", "GeneratedVisual", "Quiz"]);
const ALLOWED_GLOBAL_PROPS = new Set(["className", "id", "role", "title", "aria-label"]);

const quizPropsSchema = z.object({
  questions: z.array(multipleChoiceQuestionSchema).min(1).max(12),
  className: z.string().max(500).optional(),
});

const generatedImagePropsSchema = z.object({
  id: z.string().min(2).max(60),
  className: z.string().max(500).optional(),
  title: z.string().min(3).max(100).optional(),
  alt: z.string().min(8).max(240).optional(),
});

const generatedVisualPropsSchema = generatedImagePropsSchema;

export type TsxValidationResult = {
  renderTree: LessonRenderNode;
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

  throw new Error("Only static object keys are allowed in generated TSX props.");
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
        throw new Error("Generated TSX props may only use simple property assignments.");
      }

      result[propertyNameToString(property.name)] = expressionToJson(
        property.initializer,
      );
    }

    return result;
  }

  throw new Error("Generated TSX props may only contain JSON-compatible literals.");
}

function assertRenderablePropValue(value: JsonValue): RenderPropValue {
  if (value === null) {
    throw new Error("Generated TSX props may not use null values.");
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(assertRenderablePropValue);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, assertRenderablePropValue(item)]),
  );
}

function getJsxTagName(name: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(name)) {
    return name.text;
  }

  throw new Error("Generated TSX may only use simple JSX tag names.");
}

function readAttributes(
  tagName: string,
  attributes: ts.JsxAttributes,
): Record<string, RenderPropValue> {
  const props: Record<string, RenderPropValue> = {};

  for (const attribute of attributes.properties) {
    if (ts.isJsxSpreadAttribute(attribute)) {
      throw new Error("Generated TSX may not use JSX spread attributes.");
    }

    if (!ts.isIdentifier(attribute.name)) {
      throw new Error("Generated TSX may only use simple JSX prop names.");
    }

    const propName = attribute.name.text;

    if (propName.startsWith("on")) {
      throw new Error("Generated TSX may not define event handlers.");
    }

    if (propName === "style" || propName === "dangerouslySetInnerHTML") {
      throw new Error(`Generated TSX may not use ${propName}.`);
    }

    if (!ALLOWED_COMPONENTS.has(tagName) && !ALLOWED_GLOBAL_PROPS.has(propName)) {
      throw new Error(`Unsupported prop "${propName}" on <${tagName}>.`);
    }

    if (!attribute.initializer) {
      props[propName] = true;
      continue;
    }

    if (ts.isStringLiteral(attribute.initializer)) {
      props[propName] = attribute.initializer.text;
      continue;
    }

    if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
      props[propName] = assertRenderablePropValue(
        expressionToJson(attribute.initializer.expression),
      );
      continue;
    }

    throw new Error(`Unsupported JSX attribute value for "${propName}".`);
  }

  if (tagName === "GeneratedImage") {
    return generatedImagePropsSchema.parse(props);
  }

  if (tagName === "GeneratedVisual") {
    return generatedVisualPropsSchema.parse(props);
  }

  if (tagName === "Quiz") {
    return quizPropsSchema.parse(props);
  }

  return props;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function jsxChildToNode(child: ts.JsxChild): LessonRenderNode[] {
  if (ts.isJsxText(child)) {
    const text = normalizeText(child.getText());
    return text ? [text] : [];
  }

  if (ts.isJsxExpression(child)) {
    if (!child.expression) {
      return [];
    }

    const value = expressionToJson(child.expression);

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return [String(value)];
    }

    throw new Error("Generated TSX child expressions must resolve to text.");
  }

  return [jsxToNode(child)];
}

function jsxChildrenToNodes(children: ts.NodeArray<ts.JsxChild>) {
  return children.flatMap((child) => jsxChildToNode(child));
}

function jsxToNode(node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment): LessonRenderNode {
  if (ts.isJsxFragment(node)) {
    return {
      type: "Fragment",
      props: {},
      children: jsxChildrenToNodes(node.children),
    };
  }

  const tagName = ts.isJsxElement(node)
    ? getJsxTagName(node.openingElement.tagName)
    : getJsxTagName(node.tagName);

  if (!ALLOWED_INTRINSIC_ELEMENTS.has(tagName) && !ALLOWED_COMPONENTS.has(tagName)) {
    throw new Error(`Unsupported JSX element <${tagName}>.`);
  }

  const attributes = ts.isJsxElement(node)
    ? node.openingElement.attributes
    : node.attributes;

  return {
    type: tagName,
    props: readAttributes(tagName, attributes),
    children: ts.isJsxElement(node) ? jsxChildrenToNodes(node.children) : [],
  };
}

function isDefaultExported(node: ts.Node) {
  return Boolean(
    ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword),
  );
}

function findDefaultComponent(sourceFile: ts.SourceFile): ts.FunctionDeclaration {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && isDefaultExported(statement)) {
      return statement;
    }
  }

  throw new Error("Generated TSX must default-export a function component.");
}

function findReturnedJsx(component: ts.FunctionDeclaration) {
  if (component.parameters.length > 0) {
    throw new Error("Generated TSX components may not accept props.");
  }

  if (!component.body) {
    throw new Error("Generated TSX component is missing a body.");
  }

  const statements = component.body.statements;

  if (statements.length !== 1 || !ts.isReturnStatement(statements[0])) {
    throw new Error("Generated TSX component must contain exactly one return statement.");
  }

  const expression = statements[0].expression && unwrapExpression(statements[0].expression);

  if (
    expression &&
    (ts.isJsxElement(expression) ||
      ts.isJsxSelfClosingElement(expression) ||
      ts.isJsxFragment(expression))
  ) {
    return expression;
  }

  throw new Error("Generated TSX component must return JSX.");
}

function assertSafeModuleShape(sourceFile: ts.SourceFile) {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const moduleName = statement.moduleSpecifier;

      if (!ts.isStringLiteral(moduleName) || moduleName.text !== APPROVED_RUNTIME_MODULE) {
        throw new Error("Generated TSX may only import from the approved lesson runtime.");
      }

      continue;
    }

    if (ts.isFunctionDeclaration(statement) && isDefaultExported(statement)) {
      continue;
    }

    throw new Error("Generated TSX may only contain imports and one default component.");
  }
}

function collectGeneratedVisualIds(node: LessonRenderNode, ids = new Set<string>()) {
  if (typeof node === "string") {
    return ids;
  }

  if (
    (node.type === "GeneratedImage" || node.type === "GeneratedVisual") &&
    typeof node.props.id === "string"
  ) {
    ids.add(node.props.id);
  }

  node.children.forEach((child) => collectGeneratedVisualIds(child, ids));
  return ids;
}

export function validateGeneratedTsxSource(
  source: string,
  options: { plan: LessonPlan },
): TsxValidationResult {
  const sourceFile = ts.createSourceFile(
    "generated-lesson.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const syntaxErrors = (
    sourceFile as ts.SourceFile & {
      parseDiagnostics: readonly ts.DiagnosticWithLocation[];
    }
  ).parseDiagnostics;

  if (syntaxErrors.length > 0) {
    throw new Error(
      syntaxErrors.map((error) => error.messageText.toString()).join("; "),
    );
  }

  assertSafeModuleShape(sourceFile);

  const component = findDefaultComponent(sourceFile);
  const renderTree = lessonRenderNodeSchema.parse(
    jsxToNode(findReturnedJsx(component)),
  );
  const plannedVisualIds = new Set([
    ...options.plan.visuals.map((visual) => visual.id),
    ...options.plan.imageRequests.map((request) => request.id),
  ]);

  for (const visualId of collectGeneratedVisualIds(renderTree)) {
    if (!plannedVisualIds.has(visualId)) {
      throw new Error(`Generated visual id "${visualId}" was not requested in the plan.`);
    }
  }

  return {
    renderTree,
    normalizedSource: source.trim(),
  };
}
