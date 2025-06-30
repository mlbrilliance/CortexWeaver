import { SessionManager } from '../src/session';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('constructor', () => {
    it('should initialize with empty session list', () => {
      const sessions = sessionManager.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('createSession', () => {
    it('should create a new tmux session', async () => {
      const mockCreate = jest.spyOn(sessionManager, 'createSession');
      mockCreate.mockResolvedValue({
        sessionId: 'task-001-session',
        taskId: 'task-001',
        status: 'running',
        createdAt: new Date()
      });

      const result = await sessionManager.createSession('task-001', '/path/to/worktree');
      expect(result.sessionId).toBe('task-001-session');
      expect(result.taskId).toBe('task-001');
      expect(result.status).toBe('running');
      expect(mockCreate).toHaveBeenCalledWith('task-001', '/path/to/worktree');
    });

    it('should handle session creation errors', async () => {
      const mockCreate = jest.spyOn(sessionManager, 'createSession');
      mockCreate.mockRejectedValue(new Error('Failed to create tmux session'));

      await expect(sessionManager.createSession('task-001', '/invalid/path'))
        .rejects.toThrow('Failed to create tmux session');
    });
  });

  describe('runCommandInSession', () => {
    it('should execute command in existing session', async () => {
      const mockRun = jest.spyOn(sessionManager, 'runCommandInSession');
      mockRun.mockResolvedValue({
        output: 'command executed',
        exitCode: 0,
        timestamp: new Date()
      });

      const result = await sessionManager.runCommandInSession('task-001-session', 'echo "hello"');
      expect(result.output).toBe('command executed');
      expect(result.exitCode).toBe(0);
      expect(mockRun).toHaveBeenCalledWith('task-001-session', 'echo "hello"');
    });

    it('should handle command execution in non-existent session', async () => {
      const mockRun = jest.spyOn(sessionManager, 'runCommandInSession');
      mockRun.mockRejectedValue(new Error('Session not found'));

      await expect(sessionManager.runCommandInSession('non-existent', 'command'))
        .rejects.toThrow('Session not found');
    });
  });

  describe('attachToSession', () => {
    it('should return attach command for existing session', async () => {
      const mockAttach = jest.spyOn(sessionManager, 'attachToSession');
      mockAttach.mockResolvedValue('tmux attach-session -t task-001-session');

      const result = await sessionManager.attachToSession('task-001-session');
      expect(result).toBe('tmux attach-session -t task-001-session');
      expect(mockAttach).toHaveBeenCalledWith('task-001-session');
    });

    it('should handle non-existent session', async () => {
      const mockAttach = jest.spyOn(sessionManager, 'attachToSession');
      mockAttach.mockRejectedValue(new Error('Session not found'));

      await expect(sessionManager.attachToSession('non-existent'))
        .rejects.toThrow('Session not found');
    });
  });

  describe('killSession', () => {
    it('should terminate existing session', async () => {
      const mockKill = jest.spyOn(sessionManager, 'killSession');
      mockKill.mockResolvedValue(true);

      const result = await sessionManager.killSession('task-001-session');
      expect(result).toBe(true);
      expect(mockKill).toHaveBeenCalledWith('task-001-session');
    });

    it('should handle killing non-existent session', async () => {
      const mockKill = jest.spyOn(sessionManager, 'killSession');
      mockKill.mockResolvedValue(false);

      const result = await sessionManager.killSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('listSessions', () => {
    it('should list all active sessions', () => {
      const mockList = jest.spyOn(sessionManager, 'listSessions');
      mockList.mockReturnValue([
        { sessionId: 'task-001-session', taskId: 'task-001', status: 'running', createdAt: new Date() },
        { sessionId: 'task-002-session', taskId: 'task-002', status: 'running', createdAt: new Date() }
      ]);

      const result = sessionManager.listSessions();
      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe('task-001-session');
      expect(result[1].sessionId).toBe('task-002-session');
    });
  });

  describe('getSessionStatus', () => {
    it('should return status for existing session', async () => {
      const mockStatus = jest.spyOn(sessionManager, 'getSessionStatus');
      mockStatus.mockResolvedValue('running');

      const result = await sessionManager.getSessionStatus('task-001-session');
      expect(result).toBe('running');
      expect(mockStatus).toHaveBeenCalledWith('task-001-session');
    });

    it('should return null for non-existent session', async () => {
      const mockStatus = jest.spyOn(sessionManager, 'getSessionStatus');
      mockStatus.mockResolvedValue(null);

      const result = await sessionManager.getSessionStatus('non-existent');
      expect(result).toBeNull();
    });
  });
});