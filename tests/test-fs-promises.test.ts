import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { setupFileSystemMocks } from './test-utils';

describe('FS Promises Test', () => {
  setupFileSystemMocks();
  
  it('should be able to use fs.promises', async () => {
    console.log('fs available:', !!fs);
    console.log('fs.promises available:', !!fs.promises);
    console.log('fs.promises.mkdtemp available:', !!fs.promises?.mkdtemp);
    
    expect(fs).toBeDefined();
    expect(fs.promises).toBeDefined();
    expect(fs.promises.mkdtemp).toBeDefined();
    
    const tempPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-'));
    expect(tempPath).toBeTruthy();
    expect(tempPath).toBe('/tmp/test-12345');
    
    await fs.promises.rm(tempPath, { recursive: true, force: true });
  });
});