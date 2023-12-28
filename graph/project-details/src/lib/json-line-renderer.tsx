import useMapState from './use-map-state';

interface JsonLineRendererProps {
  jsonData: any;
}

export function JsonLineRenderer(props: JsonLineRendererProps) {
  let collapsibleSections = new Map<number, number>();
  let lines: [string, number][] = [];
  let currentLine = 0;

  const [getCollapsed, setCollapsed] = useMapState<number, boolean>();

  function add(value: string, depth: number) {
    if (lines.length === currentLine) {
      lines.push(['', depth]);
    }
    lines[currentLine] = [lines[currentLine][0] + value, depth];
  }

  function processJson(jsonData: any, depth = 0, isLast = false) {
    if (Array.isArray(jsonData)) {
      const sectionStart = currentLine;
      add('[', depth);
      currentLine++;
      jsonData.forEach((value, index) => {
        processJson(value, depth + 1, index === jsonData.length - 1);
      });
      add(']', depth);
      if (!isLast) {
        add(',', depth);
      }
      const sectionEnd = currentLine;
      collapsibleSections.set(sectionStart, sectionEnd);
      currentLine++;
    } else if (jsonData && typeof jsonData === 'object') {
      const sectionStart = currentLine;
      add('{', depth);
      currentLine++;
      Object.entries(jsonData).forEach(([key, value], index, array) => {
        add(`"${key}": `, depth);
        processJson(value, depth + 1, index === array.length - 1);
      });
      add('}', depth);
      if (!isLast) {
        add(',', depth);
      }
      const sectionEnd = currentLine;
      collapsibleSections.set(sectionStart, sectionEnd);
      currentLine++;
    } else {
      add(`"${jsonData}"`, depth);
      if (!isLast) {
        add(',', depth);
      }
      currentLine++;
    }
  }

  processJson(props.jsonData);

  function toggleCollapsed(index: number) {
    setCollapsed(index, !getCollapsed(index));
  }

  function lineIsCollapsed(index: number) {
    for (const [start, end] of collapsibleSections) {
      if (index > start && index < end) {
        if (getCollapsed(start)) {
          return true;
        }
      }
    }
    return false;
  }

  return (
    <div className="overflow-auto">
      {lines.map(([text, indentation], index) => {
        if (
          lineIsCollapsed(index) ||
          index === 0 ||
          index === lines.length - 1
        ) {
          return null;
        }
        const isCollapsible = collapsibleSections.has(index);
        const offset = Math.max(indentation - (isCollapsible ? 1 : 0), 0);
        return (
          <div style={{ paddingLeft: `${offset}rem` }}>
            {collapsibleSections.has(index) && (
              <span
                style={{ width: '1rem', display: 'inline-block' }}
                onClick={() => toggleCollapsed(index)}
              >
                {getCollapsed(index) ? '>' : 'v'}
              </span>
            )}
            {text}
            {getCollapsed(index) ? '...' : ''}
          </div>
        );
      })}
    </div>
  );
}
