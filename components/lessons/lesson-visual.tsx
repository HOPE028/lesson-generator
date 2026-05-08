"use client";

import type { z } from "zod";
import { Download } from "lucide-react";
import { useId, useRef } from "react";

import type { lessonVisualSchema } from "@/lib/lessons/schema";

type LessonVisual = z.infer<typeof lessonVisualSchema>;

export function LessonVisual({ visual }: { visual: LessonVisual }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = useId().replaceAll(":", "");

  async function downloadPng() {
    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const serializedSvg = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([serializedSvg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 3;
      const width = svg.viewBox.baseVal.width || svg.clientWidth || 200;
      const height = svg.viewBox.baseVal.height || svg.clientHeight || 120;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(svgUrl);
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.scale(scale, scale);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(svgUrl);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `${visual.id}.png`;
      link.click();
    };

    image.src = svgUrl;
  }

  return (
    <figure className="relative rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
      <button
        aria-label={`Download ${visual.title} as PNG`}
        className="absolute left-2 top-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-black/10 bg-white text-black shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500 hover:text-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
        onClick={downloadPng}
        type="button"
      >
        <Download className="h-4 w-4" />
      </button>
      <svg
        aria-label={visual.alt}
        className="h-auto w-full text-black"
        ref={svgRef}
        role="img"
        viewBox={visual.viewBox}
      >
        <defs>
          <clipPath id={`${clipId}-bounds`}>
            <rect height="100%" width="100%" x="0" y="0" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId}-bounds)`}>
        {visual.elements.map((element, index) => {
          if (element.type === "circle") {
            return <circle key={index} {...element} />;
          }
          if (element.type === "rect") {
            return <rect key={index} {...element} />;
          }
          if (element.type === "line") {
            return (
              <line
                key={index}
                strokeLinecap="round"
                strokeWidth="2"
                {...element}
              />
            );
          }

          return (
            <text
              dominantBaseline="middle"
              fontSize="12"
              key={index}
              textAnchor="middle"
              {...element}
            >
            {element.text}
          </text>
          );
        })}
        </g>
      </svg>
      <figcaption className="mt-2 text-sm font-medium text-black/70">
        {visual.title}
      </figcaption>
    </figure>
  );
}
