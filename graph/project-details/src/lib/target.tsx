/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { TargetConfiguration } from '@nx/devkit';
import PropertyRenderer from './property-renderer';
import { useState } from 'react';
import { getExternalApiService, useEnvironmentConfig } from '@nx/graph/shared';
import { PlayIcon } from '@heroicons/react/24/outline';

/* eslint-disable-next-line */
export interface TargetProps {
  projectName: string;
  targetName: string;
  targetConfiguration: TargetConfiguration;
  sourceMap: Record<string, string[]>;
}

export function Target(props: TargetProps) {
  const { environment } = useEnvironmentConfig();
  const externalApiService = getExternalApiService();

  const targetClick = () => {
    externalApiService.postEvent({
      type: 'run-task',
      payload: { taskId: `${props.projectName}:${props.targetName}` },
    });
  };

  return (
    <div className="ml-3 mb-3">
      <h3 className="text-lg font-bold flex">
        {props.targetName}{' '}
        {environment === 'nx-console' && (
          <PlayIcon className="h-5 w-5" onClick={targetClick} />
        )}
      </h3>
      <div className="ml-3">
        {Object.entries(props.targetConfiguration).map(([key, value]) =>
          PropertyRenderer({
            propertyKey: key,
            propertyValue: value,
            keyPrefix: `targets.${props.targetName}`,
            sourceMap: props.sourceMap,
          })
        )}
      </div>
    </div>
  );
}

export default Target;
