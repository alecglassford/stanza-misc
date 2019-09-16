const fsPromises = require('fs').promises;
const path = require('path')
const { finished } = require('stream');
const { promisify } = require('util');

const fetch = require('node-fetch');
const tar = require('tar');

const misc = require('./misc.json');

const finishedPromise = promisify(finished);

const PUBLIC_DIR = path.join(__dirname, 'public');
const BUILD_DIR = path.join(__dirname, 'build');
const INDEX_PATH = path.join(BUILD_DIR, 'index.html');
const LIST_TARGET = '~~INJECT_LIST_HERE~~';

const makeBullet = function makeBullet({ dest }) {
  return `<li>
    <a href="/${dest}">/${dest}</a>
  </li>`;
}

const main = async function main() {
  console.log('Deleting build/ if exists …');
  try {
    await fsPromises.rmdir(BUILD_DIR, { recursive: true });
    console.log('Deleted build/')
  } catch (err) {
    console.log('Received error:', err)
    console.log('Assuming build/ does not exist')
  }

  console.log('(Re-)Creating build/');
  await fsPromises.mkdir(BUILD_DIR);
  console.log('Created build/');

  console.log('Copying public to build …')
  const basenames = await fsPromises.readdir(PUBLIC_DIR);
  const copyOperations = basenames.map(async (basename) => {
    await fsPromises.copyFile(
      path.join(PUBLIC_DIR, basename),
      path.join(BUILD_DIR, basename),
    );
    console.log('Copied', basename);
    return true;
  })
  await Promise.all(copyOperations);
  console.log('Copied public to build ...')

  console.log('Downloading files …')
  const downloadOperations = misc.map(async (item) => {
    console.log('Downloading', item.source);
    const res = await fetch(item.source);
    const unzipper = tar.x({ cwd: BUILD_DIR });
    res.body.pipe(unzipper)
    await finishedPromise(unzipper);
    await fsPromises.rename(
      path.join(BUILD_DIR, item.unzipped_name),
      path.join(BUILD_DIR, item.dest ),
    );
    console.log('Wrote', item.dest);
    return true;
  });
  await Promise.all(downloadOperations);
  console.log('Downloaded everything');

  console.log('Updating index page …')
  const bullets = misc.map(makeBullet);
  const indexInput = await fsPromises.readFile(INDEX_PATH, 'utf8');
  const indexOutput = indexInput.replace(LIST_TARGET, bullets.join('\n'));
  await fsPromises.writeFile(INDEX_PATH, indexOutput);
  console.log("Updated index page")

  console.log('🎉');
};

main();
