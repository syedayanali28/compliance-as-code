/**
 * GitLab Client
 *
 * Handles committing IdaC YAML files to GitLab repositories
 * via the GitLab REST API v4.
 */

interface GitLabConfig {
  url: string;
  token: string;
  idacGroup: string;
}

interface CommitResult {
  commitSha: string;
  webUrl: string;
}

function getConfig(): GitLabConfig {
  return {
    url: process.env.GITLAB_URL || "",
    token: process.env.GITLAB_API_TOKEN || "",
    idacGroup: process.env.GITLAB_IDAC_GROUP || "idac",
  };
}

function apiUrl(path: string): string {
  const { url } = getConfig();
  return `${url}/api/v4${path}`;
}

function headers(): Record<string, string> {
  const { token } = getConfig();
  return {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
  };
}

/**
 * Ensure a GitLab project exists for the given project code.
 * Creates it under the IdaC group if it doesn't exist.
 * Returns the project ID.
 */
export async function ensureProject(projectCode: string): Promise<number> {
  const { idacGroup } = getConfig();
  const encodedPath = encodeURIComponent(`${idacGroup}/${projectCode}`);

  // Try to get existing project
  const getResp = await fetch(apiUrl(`/projects/${encodedPath}`), {
    headers: headers(),
  });

  if (getResp.ok) {
    const project = await getResp.json();
    return project.id;
  }

  // Get group ID first
  const groupResp = await fetch(
    apiUrl(`/groups/${encodeURIComponent(idacGroup)}`),
    { headers: headers() }
  );

  if (!groupResp.ok) {
    throw new Error(
      `GitLab group "${idacGroup}" not found. Create it first.`
    );
  }

  const group = await groupResp.json();

  // Create project in group
  const createResp = await fetch(apiUrl("/projects"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name: projectCode,
      namespace_id: group.id,
      visibility: "internal",
      description: `Infrastructure Design as Code for project ${projectCode}`,
      initialize_with_readme: true,
    }),
  });

  if (!createResp.ok) {
    const error = await createResp.text();
    throw new Error(`Failed to create GitLab project: ${error}`);
  }

  const newProject = await createResp.json();
  return newProject.id;
}

/**
 * Commit an IdaC YAML file to the project repository.
 *
 * File path: designs/v{version}/design.yaml
 * Also updates designs/latest/design.yaml
 */
export async function commitDesign(
  projectCode: string,
  version: number,
  yamlContent: string,
  commitMessage: string
): Promise<CommitResult> {
  const projectId = await ensureProject(projectCode);
  const versionPath = `designs/v${version}/design.yaml`;
  const latestPath = "designs/latest/design.yaml";

  // Check if files already exist (to decide create vs update)
  const versionExists = await fileExists(projectId, versionPath);
  const latestExists = await fileExists(projectId, latestPath);

  const actions = [
    {
      action: versionExists ? "update" : "create",
      file_path: versionPath,
      content: yamlContent,
    },
    {
      action: latestExists ? "update" : "create",
      file_path: latestPath,
      content: yamlContent,
    },
  ];

  const resp = await fetch(
    apiUrl(`/projects/${projectId}/repository/commits`),
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        branch: "main",
        commit_message: commitMessage,
        actions,
      }),
    }
  );

  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Failed to commit to GitLab: ${error}`);
  }

  const commit = await resp.json();
  return {
    commitSha: commit.id,
    webUrl: commit.web_url,
  };
}

async function fileExists(
  projectId: number,
  filePath: string
): Promise<boolean> {
  const encodedPath = encodeURIComponent(filePath);
  const resp = await fetch(
    apiUrl(
      `/projects/${projectId}/repository/files/${encodedPath}?ref=main`
    ),
    { method: "HEAD", headers: headers() }
  );
  return resp.ok;
}
