import { createRequire } from 'module';
import path from 'path';
import pMap from 'p-map';
import got from 'got';
import HttpAgent from 'agentkeepalive';

const liveOption = {
  keepAlive: true,
  maxSockets: 10,
};

const newAliveAgent = () => {
  return {
    agent: {
      http: new HttpAgent(liveOption),
      https: new HttpAgent.HttpsAgent(liveOption),
    },
  };
};

const getPackageResults = async (packageInfo) => {
  try {
    const registryInfo = await got.get(`https://registry.npmjs.org/${packageInfo.name}`, newAliveAgent()).json();
    const [version, versionInfo] = Object.entries(registryInfo.versions).find(([version]) => version === packageInfo.version);

    const info = {
      name: versionInfo.name,
      version: versionInfo.version,
    };

    if (versionInfo.deprecated) {
      return {
        ...info,
        deprecationMsg: versionInfo.deprecated,
      };
    } else {
      return info;
    }
  } catch {
    return {
      name: packageInfo.name,
      version: 'ERROR',
    };
  }
}

const main = async () => {

  const packagePath = path.join(process.cwd(), 'package.json');
  const packageLockPath = path.join(process.cwd(), 'package-lock.json');

  const require = createRequire(import.meta.url);
  const packageFile = require(packagePath);
  const packageLock = require(packageLockPath);

  const dependencies = Object.keys(packageFile.dependencies);
  const devDependencies = Object.keys(packageFile.devDependencies);
  const allDependencies = [
    ...dependencies,
    ...devDependencies,
  ]

  const immediatePackages = Object.entries(packageLock.dependencies)
    .filter(([name]) => allDependencies.includes(name))
    .map(([name, info]) => ({name, version: info.version}));

  const result = await pMap(immediatePackages, getPackageResults, {getPackageResults: 2});

  console.log('Deprecated:');
  console.log('-----------');
  const deprecated = result.filter(item => item.deprecationMsg);
  if (deprecated.length > 0) {
    deprecated.forEach(item => {
      console.log(`${item.name}: ${item.deprecationMsg}`);
    });
  } else {
    console.log('No Deprecations');
  }

  console.log('\n');
  console.log('Error Fetching:');
  console.log('---------------');
  const errors = result.filter(item => item.version === 'ERROR');
  if (errors.length > 0) {
    errors.forEach(item => {
      console.log(`${item.name}`);
    });
  } else {
    console.log("No Errors");
  }
}

main();