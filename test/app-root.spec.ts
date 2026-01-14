import { join } from 'path';
import { resolveAppRoot } from '../src/common/app-root';

describe('resolveAppRoot', () => {
  it('returns parent dir when package.json exists there', () => {
    const runtimeDirname = join('project', 'src');
    const runtimeCwd = join('project');
    const expected = join(runtimeDirname, '..');
    const pathExists = jest.fn((filePath: string) => {
      return filePath === join(expected, 'package.json');
    });

    const appRoot = resolveAppRoot({ runtimeDirname, runtimeCwd, pathExists });

    expect(appRoot).toBe(expected);
    expect(pathExists).toHaveBeenCalledTimes(1);
    expect(pathExists).toHaveBeenCalledWith(join(expected, 'package.json'));
  });

  it('returns grandparent dir when build output is nested', () => {
    const runtimeDirname = join('project', 'dist', 'src');
    const runtimeCwd = join('project');
    const expected = join(runtimeDirname, '..', '..');
    const pathExists = jest.fn((filePath: string) => {
      return filePath === join(expected, 'package.json');
    });

    const appRoot = resolveAppRoot({ runtimeDirname, runtimeCwd, pathExists });

    expect(appRoot).toBe(expected);
    expect(pathExists).toHaveBeenCalledTimes(2);
    expect(pathExists).toHaveBeenNthCalledWith(1, join(join(runtimeDirname, '..'), 'package.json'));
    expect(pathExists).toHaveBeenNthCalledWith(2, join(expected, 'package.json'));
  });

  it('falls back to cwd when package.json cannot be found', () => {
    const runtimeDirname = join('somewhere', 'else');
    const runtimeCwd = join('project');
    const pathExists = jest.fn(() => {
      return false;
    });

    const appRoot = resolveAppRoot({ runtimeDirname, runtimeCwd, pathExists });

    expect(appRoot).toBe(runtimeCwd);
    expect(pathExists).toHaveBeenCalledTimes(3);
    expect(pathExists).toHaveBeenNthCalledWith(1, join(join(runtimeDirname, '..'), 'package.json'));
    expect(pathExists).toHaveBeenNthCalledWith(2, join(join(runtimeDirname, '..', '..'), 'package.json'));
    expect(pathExists).toHaveBeenNthCalledWith(3, join(runtimeCwd, 'package.json'));
  });
});

