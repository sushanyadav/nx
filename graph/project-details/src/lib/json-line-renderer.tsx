import { PlayIcon } from '@heroicons/react/24/outline';
import { getSourceInformation } from './get-source-information';
import useMapState from './use-map-state';

interface JsonLineRendererProps {
  jsonData: any;
  sourceMap: Record<string, string[]>;
}

export function JsonLineRenderer(props: JsonLineRendererProps) {
  let collapsibleSections = new Map<number, number>();
  let lines: [string, number][] = [];
  let currentLine = 0;
  let lineToPropertyPathMap = new Map<number, string>();
  let lineToInteractionMap = new Map<
    number,
    { target?: string; configuration?: string }
  >();

  const [getCollapsed, setCollapsed] = useMapState<number, boolean>();

  function add(value: string, depth: number) {
    if (lines.length === currentLine) {
      lines.push(['', depth]);
    }
    lines[currentLine] = [lines[currentLine][0] + value, depth];
  }

  function processJson(
    jsonData: any,
    depth = 0,
    propertyPath = '',
    isLast = false
  ) {
    if (Array.isArray(jsonData)) {
      const sectionStart = currentLine;
      add('[', depth);
      currentLine++;

      jsonData.forEach((value, index) => {
        const newPropertyPath = `${
          propertyPath ? propertyPath + '.' : ''
        }${value}`;
        lineToPropertyPathMap.set(currentLine, newPropertyPath);

        processJson(
          value,
          depth + 1,
          newPropertyPath,
          index === jsonData.length - 1
        );
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

        if (propertyPath === 'targets') {
          lineToInteractionMap.set(currentLine, { target: key });
        }
        if (propertyPath.match(/^targets\..*configurations$/)) {
          lineToInteractionMap.set(currentLine, {
            target: propertyPath.split('.')[1],
            configuration: key,
          });
        }

        const newPropertyPath = `${
          propertyPath ? propertyPath + '.' : ''
        }${key}`;
        lineToPropertyPathMap.set(currentLine, newPropertyPath);

        processJson(
          value,
          depth + 1,
          newPropertyPath,
          index === array.length - 1
        );
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
  console.log(lineToInteractionMap);

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

  function runTarget({
    target,
    configuration,
  }: {
    target?: string;
    configuration?: string;
  }) {
    console.log(target, configuration);
  }

  return (
    <div className="overflow-auto w-full">
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
        const propertyPathAtLine = lineToPropertyPathMap.get(index);
        const sourceInformation = propertyPathAtLine
          ? getSourceInformation(props.sourceMap, propertyPathAtLine)
          : '';
        return (
          <div
            style={{ paddingLeft: `${offset}rem` }}
            className="group truncate hover:bg-slate-800"
          >
            {collapsibleSections.has(index) && (
              <span
                style={{ width: '1rem', display: 'inline' }}
                onClick={() => toggleCollapsed(index)}
              >
                {getCollapsed(index) ? '>' : 'v'}
              </span>
            )}
            {text}
            {getCollapsed(index) ? '...' : ''}
            {lineToInteractionMap.get(index)?.target && (
              <PlayIcon
                className="h-5 w-5 inline"
                onClick={() => runTarget(lineToInteractionMap.get(index)!)}
              />
            )}

            <span
              className="ml-32 hidden group-hover:inline-block text-sm text-slate-500"
              title="yelloooo"
            >
              {sourceInformation}
            </span>
          </div>
        );
      })}
    </div>
  );
}
