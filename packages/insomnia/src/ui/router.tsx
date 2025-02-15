import './rendererListeners';

import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import {
  createMemoryRouter,
  matchPath,
  Outlet,
  RouterProvider,
} from 'react-router-dom';

import {
  ACTIVITY_DEBUG,
  ACTIVITY_SPEC,
  getProductName,
  isDevelopment,
} from '../common/constants';
import { database } from '../common/database';
import { initializeLogging } from '../common/log';
import * as models from '../models';
import { DEFAULT_ORGANIZATION_ID } from '../models/organization';
import { DEFAULT_PROJECT_ID } from '../models/project';
import { initNewOAuthSession } from '../network/o-auth-2/get-token';
import { init as initPlugins } from '../plugins';
import { applyColorScheme } from '../plugins/misc';
import { guard } from '../utils/guard';
import { AppLoadingIndicator } from './components/app-loading-indicator';
import { ErrorRoute } from './routes/error';
import { shouldOrganizationsRevalidate } from './routes/organization';
import Root from './routes/root';

const Project = lazy(() => import('./routes/project'));
const Workspace = lazy(() => import('./routes/workspace'));
const UnitTest = lazy(() => import('./routes/unit-test'));
const Debug = lazy(() => import('./routes/debug'));
const Design = lazy(() => import('./routes/design'));

const LLMRoute = lazy(() => import('./routes/llm'));


initializeLogging();
// Handy little helper
document.body.setAttribute('data-platform', process.platform);
document.title = getProductName();

let locationHistoryEntry = `/organization/${DEFAULT_ORGANIZATION_ID}/project/${DEFAULT_PROJECT_ID}`;
const prevLocationHistoryEntry = localStorage.getItem('locationHistoryEntry');

if (prevLocationHistoryEntry && matchPath({ path: '/organization/:organizationId', end: false }, prevLocationHistoryEntry)) {
  locationHistoryEntry = prevLocationHistoryEntry;
}

export const setupRouterStuff = (beginningPath: string | null = null) => {

  const router = createMemoryRouter(
    // @TODO - Investigate file based routing to generate these routes:
    [
      {
        path: '/',
        id: 'root',
        loader: async (...args) =>
          (await import('./routes/root')).loader(...args),
        element: <Root />,
        errorElement: <ErrorRoute />,
        children: [
          {
            path: 'import',
            children: [
              {
                path: 'scan',
                action: async (...args) =>
                  (await import('./routes/import')).scanForResourcesAction(
                    ...args,
                  ),
              },
              {
                path: 'resources',
                action: async (...args) =>
                  (await import('./routes/importResourcesAction')).importResourcesAction(
                    ...args,
                  ),
              },
            ],
          },
          {
            path: 'settings/update',
            action: async (...args) =>
              (await import('./routes/actions')).updateSettingsAction(...args),
          },
          {
            id: '/llm',
            path: 'llm',
            element: (
              <Suspense >
                <LLMRoute />
              </Suspense>
            ),
          },
          {
            path: 'organization',
            id: '/organization',
            children: [
              {
                path: ':organizationId',
                children: [
                  {
                    index: true,
                    loader: async (...args) =>
                      (await import('./routes/project')).indexLoader(...args),
                  },
                  {
                    path: 'project',
                    children: [
                      {
                        path: ':projectId',
                        id: '/project/:projectId',
                        loader: async (...args) =>
                          (await import('./routes/project')).loader(...args),
                        element: (
                          <Suspense >
                            <Project />
                          </Suspense>
                        ),
                        children: [
                          {
                            path: 'delete',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).deleteProjectAction(...args),
                          },
                          {
                            path: 'rename',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).renameProjectAction(...args),
                          },
                          {
                            path: 'git',
                            children: [
                              {
                                path: 'clone',
                                action: async (...args) =>
                                  (
                                    await import('./routes/git-actions')
                                  ).cloneGitRepoAction(...args),
                              },
                            ],
                          },
                        ],
                      },
                      {
                        path: ':projectId/workspace',
                        children: [
                          {
                            path: ':workspaceId',
                            id: ':workspaceId',
                            loader: async (...args) =>
                              (
                                await import('./routes/workspace')
                              ).workspaceLoader(...args),
                            element: (
                              <Suspense >
                                <Workspace />
                              </Suspense>
                            ),
                            children: [
                              {
                                path: `${ACTIVITY_DEBUG}`,
                                loader: async (...args) =>
                                  (await import('./routes/debug')).loader(
                                    ...args,
                                  ),
                                element: (
                                  <Suspense >
                                    <Debug />
                                  </Suspense>
                                ),
                                children: [
                                  {
                                    path: 'reorder',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).reorderCollectionAction(...args),
                                  },
                                  {
                                    path: 'request/:requestId',
                                    id: 'request/:requestId',
                                    loader: async (...args) =>
                                      (await import('./routes/request')).loader(
                                        ...args,
                                      ),
                                    element: <Outlet />,
                                    children: [
                                      {
                                        path: 'send',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).sendAction(...args),
                                      },
                                      {
                                        path: 'connect',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).connectAction(...args),
                                      },
                                      {
                                        path: 'duplicate',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).duplicateRequestAction(...args),
                                      },
                                      {
                                        path: 'update',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).updateRequestAction(...args),
                                      },
                                      {
                                        path: 'update-meta',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).updateRequestMetaAction(...args),
                                      },
                                      {
                                        path: 'response/delete-all',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).deleteAllResponsesAction(...args),
                                      },
                                      {
                                        path: 'response/delete',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).deleteResponseAction(...args),
                                      },
                                    ],
                                  },
                                  {
                                    path: 'request/new',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/request')
                                      ).createRequestAction(...args),
                                  },
                                  {
                                    path: 'request/delete',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/request')
                                      ).deleteRequestAction(...args),
                                  },
                                  {
                                    path: 'request-group/new',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/request-group')
                                      ).createRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/delete',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/request-group')
                                      ).deleteRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/:requestGroupId/update',
                                    action: async (...args) => (await import('./routes/request-group')).updateRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/duplicate',
                                    action: async (...args) => (await import('./routes/request-group')).duplicateRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/:requestGroupId/update-meta',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/request-group')
                                      ).updateRequestGroupMetaAction(...args),
                                  },
                                ],
                              },
                              {
                                path: `${ACTIVITY_SPEC}`,
                                loader: async (...args) =>
                                  (await import('./routes/design')).loader(
                                    ...args,
                                  ),
                                element: (
                                  <Suspense >
                                    <Design />
                                  </Suspense>
                                ),
                                children: [
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).updateApiSpecAction(...args),
                                  },
                                  {
                                    path: 'generate-request-collection',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).generateCollectionFromApiSpecAction(
                                        ...args,
                                      ),
                                  },
                                ],
                              },
                              {
                                path: 'cacert',
                                children: [
                                  {
                                    path: 'new',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).createNewCaCertificateAction(...args),
                                  },
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).updateCaCertificateAction(...args),
                                  },
                                  {
                                    path: 'delete',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).deleteCaCertificateAction(...args),
                                  },
                                ],
                              },
                              {
                                path: 'clientcert',
                                children: [
                                  {
                                    path: 'new',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).createNewClientCertificateAction(...args),
                                  },
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).updateClientCertificateAction(...args),
                                  },
                                  {
                                    path: 'delete',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).deleteClientCertificateAction(...args),
                                  },
                                ],
                              },
                              {
                                path: 'environment',
                                children: [
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).updateEnvironment(...args),
                                  },
                                  {
                                    path: 'delete',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).deleteEnvironmentAction(...args),
                                  },
                                  {
                                    path: 'create',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).createEnvironmentAction(...args),
                                  },
                                  {
                                    path: 'duplicate',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).duplicateEnvironmentAction(...args),
                                  },
                                  {
                                    path: 'set-active',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).setActiveEnvironmentAction(...args),
                                  },
                                ],
                              },
                              {
                                path: 'cookieJar',
                                children: [
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).updateCookieJarAction(...args),
                                  },
                                ],
                              },
                              {
                                path: 'test/*',
                                loader: async (...args) =>
                                  (await import('./routes/unit-test')).loader(
                                    ...args,
                                  ),
                                element: (
                                  <Suspense >
                                    <UnitTest />
                                  </Suspense>
                                ),
                                children: [
                                  {
                                    index: true,
                                    loader: async (...args) =>
                                      (
                                        await import('./routes/test-suite')
                                      ).indexLoader(...args),
                                  },
                                  {
                                    path: 'test-suite',
                                    children: [
                                      {
                                        index: true,
                                        loader: async (...args) =>
                                          (
                                            await import('./routes/test-suite')
                                          ).indexLoader(...args),
                                      },
                                      {
                                        path: 'new',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/actions')
                                          ).createNewTestSuiteAction(...args),
                                      },
                                      {
                                        path: ':testSuiteId',
                                        id: ':testSuiteId',
                                        loader: async (...args) =>
                                          (
                                            await import('./routes/test-suite')
                                          ).loader(...args),
                                        children: [
                                          {
                                            index: true,
                                            loader: async (...args) =>
                                              (
                                                await import(
                                                  './routes/test-results'
                                                )
                                              ).indexLoader(...args),
                                          },
                                          {
                                            path: 'test-result',
                                            children: [
                                              {
                                                path: ':testResultId',
                                                id: ':testResultId',
                                                loader: async (...args) =>
                                                  (
                                                    await import(
                                                      './routes/test-results'
                                                    )
                                                  ).loader(...args),
                                              },
                                            ],
                                          },
                                          {
                                            path: 'delete',
                                            action: async (...args) =>
                                              (
                                                await import('./routes/actions')
                                              ).deleteTestSuiteAction(...args),
                                          },
                                          {
                                            path: 'rename',
                                            action: async (...args) =>
                                              (
                                                await import('./routes/actions')
                                              ).renameTestSuiteAction(...args),
                                          },
                                          {
                                            path: 'run-all-tests',
                                            action: async (...args) =>
                                              (
                                                await import('./routes/actions')
                                              ).runAllTestsAction(...args),
                                          },
                                          {
                                            path: 'test',
                                            children: [
                                              {
                                                path: 'new',
                                                action: async (...args) =>
                                                  (
                                                    await import(
                                                      './routes/actions'
                                                    )
                                                  ).createNewTestAction(...args),
                                              },
                                              {
                                                path: ':testId',
                                                children: [
                                                  {
                                                    path: 'delete',
                                                    action: async (...args) =>
                                                      (
                                                        await import(
                                                          './routes/actions'
                                                        )
                                                      ).deleteTestAction(...args),
                                                  },
                                                  {
                                                    path: 'update',
                                                    action: async (...args) =>
                                                      (
                                                        await import(
                                                          './routes/actions'
                                                        )
                                                      ).updateTestAction(...args),
                                                  },
                                                  {
                                                    path: 'run',
                                                    action: async (...args) =>
                                                      (
                                                        await import(
                                                          './routes/actions'
                                                        )
                                                      ).runTestAction(...args),
                                                  },
                                                ],
                                              },
                                            ],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                              {
                                path: 'ai',
                                children: [
                                  {
                                    path: 'generate',
                                    children: [
                                      {
                                        path: 'collection-and-tests',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/actions')
                                          ).generateCollectionAndTestsAction(
                                            ...args,
                                          ),
                                      },
                                      {
                                        path: 'tests',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/actions')
                                          ).generateTestsAction(...args),
                                      },
                                    ],
                                  },
                                  {
                                    path: 'access',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).accessAIApiAction(...args),
                                  },
                                ],
                              },
                              {
                                path: 'duplicate',
                                action: async (...args) =>
                                  (
                                    await import('./routes/actions')
                                  ).duplicateWorkspaceAction(...args),
                              },
                              {
                                path: 'git',
                                children: [
                                  {
                                    path: 'status',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).gitStatusAction(...args),
                                  },
                                  {
                                    path: 'changes',
                                    loader: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).gitChangesLoader(...args),
                                  },
                                  {
                                    path: 'commit',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).commitToGitRepoAction(...args),
                                  },
                                  {
                                    path: 'branches',
                                    loader: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).gitBranchesLoader(...args),
                                  },
                                  {
                                    path: 'log',
                                    loader: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).gitLogLoader(...args),
                                  },
                                  {
                                    path: 'fetch',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).gitFetchAction(...args),
                                  },
                                  {
                                    path: 'branch',
                                    children: [
                                      {
                                        path: 'new',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/git-actions')
                                          ).createNewGitBranchAction(...args),
                                      },
                                      {
                                        path: 'delete',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/git-actions')
                                          ).deleteGitBranchAction(...args),
                                      },
                                      {
                                        path: 'checkout',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/git-actions')
                                          ).checkoutGitBranchAction(...args),
                                      },
                                      {
                                        path: 'merge',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/git-actions')
                                          ).mergeGitBranchAction(...args),
                                      },
                                    ],
                                  },
                                  {
                                    path: 'rollback',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).gitRollbackChangesAction(...args),
                                  },
                                  {
                                    path: 'repo',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).gitRepoAction(...args),
                                  },
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).updateGitRepoAction(...args),
                                  },
                                  {
                                    path: 'reset',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).resetGitRepoAction(...args),
                                  },
                                  {
                                    path: 'pull',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).pullFromGitRemoteAction(...args),
                                  },
                                  {
                                    path: 'push',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/git-actions')
                                      ).pushToGitRemoteAction(...args),
                                  },
                                ],
                              },
                            ],
                          },
                          {
                            path: 'new',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).createNewWorkspaceAction(...args),
                          },
                          {
                            path: 'delete',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).deleteWorkspaceAction(...args),
                          },
                          {
                            path: 'update',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).updateWorkspaceAction(...args),
                          },
                          {
                            path: ':workspaceId/update-meta',
                            action: async (...args) =>
                              (await import('./routes/actions')).updateWorkspaceMetaAction(
                                ...args
                              ),
                          },
                        ],
                      },
                      {
                        path: 'new',
                        action: async (...args) =>
                          (
                            await import('./routes/actions')
                          ).createNewProjectAction(...args),
                      },
                      {
                        path: ':projectId/remote-collections',
                        loader: async (...args) =>
                          (
                            await import('./routes/remote-collections')
                          ).remoteCollectionsLoader(...args),
                        children: [
                          {
                            path: 'pull',
                            action: async (...args) =>
                              (
                                await import('./routes/remote-collections')
                              ).pullRemoteCollectionAction(...args),
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    {
      initialEntries: [beginningPath || locationHistoryEntry],
    },
  );

  // Store the last location in local storage
  router.subscribe(({ location }) => {
    const match = matchPath(
      {
        path: '/organization/:organizationId',
        end: false,
      },
      location.pathname
    );

    if (match?.params.organizationId) {
      localStorage.setItem('requester_locationHistoryEntry', location.pathname);
    }
    localStorage.setItem('locationHistoryEntry', location.pathname);
    match?.params.organizationId && localStorage.setItem(`locationHistoryEntry:${match?.params.organizationId}`, location.pathname);
    console.log("location.pathname", location.pathname)
  })

  return router

}
