"use client";

import { Highlight, themes } from "prism-react-renderer";
import { useTheme } from "next-themes";

interface SyntaxLineProps {
  content: string;
  language: string;
}

export function SyntaxLine({ content, language }: SyntaxLineProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? themes.vsDark : themes.github;

  if (!language) {
    return <>{content}</>;
  }

  return (
    <Highlight theme={theme} code={content} language={language}>
      {({ tokens, getTokenProps }) => (
        <>
          {tokens[0]?.map((token, key) => {
            const tokenProps = getTokenProps({ token });
            return (
              <span
                key={key}
                {...tokenProps}
                style={{
                  ...tokenProps.style,
                  backgroundColor: "transparent",
                }}
              />
            );
          })}
        </>
      )}
    </Highlight>
  );
}
