const fs = require('fs');
const path = require('path');

const copyDir = (from, to) => {
  if (!fs.existsSync(from)) {
    return;
  }

  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
};

const copyFile = (from, to) => {
  if (!fs.existsSync(from)) {
    return;
  }

  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist');

copyDir(path.join(projectRoot, 'views'), path.join(distRoot, 'views'));
copyDir(path.join(projectRoot, 'public'), path.join(distRoot, 'public'));
copyFile(path.join(projectRoot, 'package.json'), path.join(distRoot, 'package.json'));
copyFile(path.join(projectRoot, 'package-lock.json'), path.join(distRoot, 'package-lock.json'));
