import { Node, mergeAttributes } from "@tiptap/react";

export interface TimestampOptions {
  readonly onTimestampClick?: (seconds: number) => void;
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    timestamp: {
      insertTimestamp: (attrs: {
        seconds: number;
        display: string;
      }) => ReturnType;
    };
  }
}

export const Timestamp = Node.create<TimestampOptions>({
  name: "timestamp",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return {
      onTimestampClick: undefined,
    };
  },

  addAttributes() {
    return {
      seconds: { default: 0 },
      display: { default: "0:00" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="timestamp"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "timestamp",
        class: "timestamp-chip",
      }),
      `[${HTMLAttributes.display}]`,
    ];
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement("span");
      dom.className =
        "timestamp-chip inline-flex items-center rounded-md bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 cursor-pointer hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 select-none mx-0.5";
      dom.setAttribute("data-type", "timestamp");
      dom.contentEditable = "false";

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (typeof value === "string") {
          dom.setAttribute(key, value);
        }
      });

      dom.textContent = `[${node.attrs.display}]`;

      dom.addEventListener("click", () => {
        this.options.onTimestampClick?.(node.attrs.seconds);
      });

      return { dom };
    };
  },

  addCommands() {
    return {
      insertTimestamp:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
