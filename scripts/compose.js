import { spawnSync } from 'node:child_process';

function dockerIsReachable(environment) {
  const result = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    env: environment,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function resolveContainerEnvironment() {
  if (dockerIsReachable(process.env)) return process.env;

  const uid = process.getuid?.();
  if (uid === undefined) return null;

  spawnSync('systemctl', ['--user', 'start', 'podman.socket'], { stdio: 'ignore' });
  const podmanEnvironment = {
    ...process.env,
    DOCKER_HOST: `unix:///run/user/${uid}/podman/podman.sock`,
  };

  if (dockerIsReachable(podmanEnvironment)) {
    console.log('Docker daemon unavailable; using the rootless Podman socket.');
    return podmanEnvironment;
  }

  return null;
}

const environment = resolveContainerEnvironment();
if (!environment) {
  console.error(
    'No usable container engine was found. Start Docker, join its permitted user group, or install rootless Podman.',
  );
  process.exit(1);
}

const result = spawnSync('docker', ['compose', ...process.argv.slice(2)], {
  env: environment,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
