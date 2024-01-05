/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphClientResponse } from 'nx/src/command-line/graph/graph';
import { useParams, useRouteLoaderData } from 'react-router-dom';

export function ProjectDetailsModal() {
  const selectedWorkspaceRouteData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse & { sourceMaps: string[] };
  const routeParams = useParams();

  console.log(selectedWorkspaceRouteData);

  return <div className="w-16 h-16 bg-red-400"></div>;
}
