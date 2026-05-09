"use client";

import { createElement, Fragment, type ReactNode } from "react";

import type {
  LessonAssetManifest,
  LessonRenderNode,
} from "@/lib/lessons/schema";
import { cn } from "@/lib/utils";
import { LessonVisual } from "@/components/lessons/lesson-visual";
import { QuizSection } from "@/components/lessons/quiz-section";

const INTRINSIC_ELEMENTS = new Set([
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

type GeneratedImageProps = {
  id: string;
  className?: string;
  title?: string;
  alt?: string;
};

type GeneratedVisualProps = GeneratedImageProps;

type QuizProps = {
  questions: Parameters<typeof QuizSection>[0]["questions"];
  className?: string;
};

export function GeneratedImage(props: GeneratedImageProps) {
  void props;
  return null;
}

export function GeneratedVisual(props: GeneratedVisualProps) {
  void props;
  return null;
}

export function Quiz(props: QuizProps) {
  void props;
  return null;
}

function renderNode(
  node: LessonRenderNode,
  assets: LessonAssetManifest,
  key: string,
): ReactNode {
  if (typeof node === "string") {
    return node;
  }

  if (node.type === "Fragment") {
    return (
      <Fragment key={key}>
        {node.children.map((child, index) =>
          renderNode(child, assets, `${key}-${index}`),
        )}
      </Fragment>
    );
  }

  if (node.type === "GeneratedImage" || node.type === "GeneratedVisual") {
    const id = node.props.id;

    if (typeof id !== "string") {
      return null;
    }

    const visual = assets[id];

    if (!visual) {
      return (
        <div
          className={cn(
            "rounded-lg border border-dashed border-black/20 bg-white/60 p-4 text-sm text-black/60",
            typeof node.props.className === "string" ? node.props.className : undefined,
          )}
          key={key}
        >
          Visual unavailable: {id}
        </div>
      );
    }

    return (
      <div
        className={typeof node.props.className === "string" ? node.props.className : undefined}
        key={key}
      >
        <LessonVisual visual={visual} />
      </div>
    );
  }

  if (node.type === "Quiz") {
    const questions = Array.isArray(node.props.questions) ? node.props.questions : [];
    const visuals = Object.values(assets);

    return (
      <div
        className={typeof node.props.className === "string" ? node.props.className : undefined}
        key={key}
      >
        <QuizSection questions={questions as QuizProps["questions"]} visuals={visuals} />
      </div>
    );
  }

  if (!INTRINSIC_ELEMENTS.has(node.type)) {
    return null;
  }

  const props = Object.fromEntries(
    Object.entries(node.props).flatMap(([name, value]) => {
      if (typeof value === "object") {
        return [];
      }

      return [[name, value]];
    }),
  );

  return createElement(
    node.type,
    { ...props, key },
    node.children.map((child, index) => renderNode(child, assets, `${key}-${index}`)),
  );
}

export function GeneratedLessonRuntime({
  assets,
  renderTree,
}: {
  assets: LessonAssetManifest;
  renderTree: LessonRenderNode;
}) {
  return <>{renderNode(renderTree, assets, "root")}</>;
}
