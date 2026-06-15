const ACTUAL_PEERS_LABEL = "ACTUAL_PEERS";

export function TextWithActualPeersLink({ href, text }: { href?: string; text: string }) {
  const cleanHref = href?.trim();

  if (!cleanHref || !text.includes(ACTUAL_PEERS_LABEL)) {
    return <>{text}</>;
  }

  const chunks = text.split(ACTUAL_PEERS_LABEL);
  const nodes: React.ReactNode[] = [];

  chunks.forEach((chunk, index) => {
    if (chunk) {
      nodes.push(chunk);
    }

    if (index < chunks.length - 1) {
      nodes.push(
        <a className="actualPeersLink" href={cleanHref} key={`actual-peers-${index}`} rel="noreferrer" target="_blank">
          {ACTUAL_PEERS_LABEL}
        </a>,
      );
    }
  });

  return <>{nodes}</>;
}

export function JoinedTextWithActualPeersLinks({ href, texts }: { href?: string; texts: readonly string[] }) {
  return (
    <>
      {texts.map((text, index) => (
        <span key={`${index}-${text}`}>
          <TextWithActualPeersLink href={href} text={text} />
          {index < texts.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}
