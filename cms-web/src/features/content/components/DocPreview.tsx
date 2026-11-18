import type { ReactNode } from 'react';
import type { RichTextDoc } from '../types/content.types';

interface PreviewNode {
  readonly type?: string;
  readonly text?: string;
  readonly attrs?: Readonly<Record<string, string | number | undefined>>;
  readonly content?: readonly PreviewNode[];
  readonly marks?: readonly PreviewNode[];
}

const BLOCKS: Readonly<Record<string, keyof React.JSX.IntrinsicElements>> = {
  paragraph: 'p',
  bulletList: 'ul',
  orderedList: 'ol',
  listItem: 'li',
  blockquote: 'blockquote',
  codeBlock: 'pre',
};
const MARKS: Readonly<Record<string, keyof React.JSX.IntrinsicElements>> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  code: 'code',
};

function withMark(children: ReactNode, mark: PreviewNode): ReactNode {
  if (mark.type === 'link') return <a href={String(mark.attrs?.['href'])}>{children}</a>;
  const Tag = MARKS[mark.type ?? ''];
  return Tag ? <Tag>{children}</Tag> : children;
}

function childrenOf(node: PreviewNode): ReactNode {
  return (node.content ?? []).map((child, index) => <NodeView key={index} node={child} />);
}

const LEAVES: Readonly<Record<string, (node: PreviewNode) => ReactNode>> = {
  text: (node) => (node.marks ?? []).reduce<ReactNode>(withMark, node.text),
  hardBreak: () => <br />,
  horizontalRule: () => <hr />,
  image: ({ attrs }) => (
    <img
      src={String(attrs?.['src'])}
      alt={attrs?.['alt']?.toString() ?? ''}
      style={{ maxWidth: '100%' }}
    />
  ),
  heading: (node) => {
    const level = node.attrs?.['level'] ?? 2;
    const Tag = `h${String(level)}` as 'h2';
    return <Tag>{childrenOf(node)}</Tag>;
  },
};

function NodeView({ node }: { readonly node: PreviewNode }): ReactNode {
  const type = node.type ?? '';
  const leaf = LEAVES[type];
  if (leaf) return leaf(node);
  const Tag = BLOCKS[type];
  return Tag ? <Tag>{childrenOf(node)}</Tag> : childrenOf(node);
}

export interface DocPreviewProps {
  readonly doc: RichTextDoc;
}

// 03-DESIGN 19.5. React elements from the sanitized tree, so nothing is ever parsed as HTML.
export function DocPreview({ doc }: DocPreviewProps) {
  return <NodeView node={doc} />;
}
