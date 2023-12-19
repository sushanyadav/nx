// eslint-disable-next-line @typescript-eslint/no-unused-vars
import styles from './app.module.css';
import Target from './target';

import PropertyRenderer from './property-renderer';
import { useNavigate, useRouteLoaderData } from 'react-router-dom';

/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphProjectNode } from '@nx/devkit';
import {
  getExternalApiService,
  useEnvironmentConfig,
  useRouteConstructor,
} from '@nx/graph/shared';
import { EyeIcon } from '@heroicons/react/24/outline';

export function ProjectDetails() {
  const {
    project: {
      name,
      data: { targets, root, ...projectData },
    },
    sourceMap,
  } = useRouteLoaderData('selectedProjectDetails') as {
    project: ProjectGraphProjectNode;
    sourceMap: Record<string, string[]>;
  };

  const { environment } = useEnvironmentConfig();
  const externalApiService = getExternalApiService();
  const navigate = useNavigate();
  const routeContructor = useRouteConstructor();

  const viewInProjectGraph = () => {
    if (environment === 'nx-console') {
      externalApiService.postEvent({
        type: 'open-project-graph',
        payload: {
          projectName: name,
        },
      });
    } else {
      navigate(routeContructor(`/projects/${encodeURIComponent(name)}`, true));
    }
  };

  return (
    <div className="m-4 overflow-auto w-full">
      <h1 className="text-2xl flex">
        {name}{' '}
        <EyeIcon className="h-5 w-5" onClick={viewInProjectGraph}></EyeIcon>
      </h1>
      <h2 className="text-lg pl-6 mb-3 flex flex-row gap-2">
        {root}{' '}
        {projectData.tags?.map((tag) => (
          <p className="bg-slate-300">{tag}</p>
        ))}
      </h2>
      <div>
        <div className="mb-2">
          <h2 className="text-xl">Targets</h2>
          {Object.entries(targets ?? {}).map(([targetName, target]) =>
            Target({
              projectName: name,
              targetName: targetName,
              targetConfiguration: target,
              sourceMap,
            })
          )}
        </div>
        {Object.entries(projectData).map(([key, value]) => {
          if (
            key === 'targets' ||
            key === 'root' ||
            key === 'name' ||
            key === '$schema' ||
            key === 'tags' ||
            key === 'files'
          )
            return undefined;

          return PropertyRenderer({
            propertyKey: key,
            propertyValue: value,
            sourceMap,
          });
        })}
      </div>
    </div>
  );
}

export default ProjectDetails;
