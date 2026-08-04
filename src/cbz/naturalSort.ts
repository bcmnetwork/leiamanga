// Splits a filename into text/number chunks so "page10" sorts after "page9".
export function naturalCompare(a: string, b: string): number {
  const ax: (string | number)[] = [];
  const bx: (string | number)[] = [];

  a.replace(/(\d+)|(\D+)/g, (_match, d?: string, s?: string) => {
    ax.push(d ? parseInt(d, 10) : (s ?? ''));
    return '';
  });
  b.replace(/(\d+)|(\D+)/g, (_match, d?: string, s?: string) => {
    bx.push(d ? parseInt(d, 10) : (s ?? ''));
    return '';
  });

  while (ax.length && bx.length) {
    const an = ax.shift() as string | number;
    const bn = bx.shift() as string | number;
    if (an !== bn) {
      if (typeof an === typeof bn) {
        return an < bn ? -1 : an > bn ? 1 : 0;
      }
      return typeof an === 'number' ? -1 : 1;
    }
  }
  return ax.length - bx.length;
}
