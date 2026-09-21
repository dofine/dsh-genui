// install.sh: the fork's install path, driven through a REAL shell with a temp
// DSH_HOME and stubbed dsh/pnpm. Two properties matter: the install command is
// the GitHub source install (`github:dofine/dsh-genui`, whose committed lib/ is
// what a user loads), and the script writes no skill files itself — the plugin
// registers SKILL.md as a bundled skill provider at runtime.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const INSTALL = join(process.cwd(), 'scripts', 'install.sh')
const GITHUB_SPEC = 'github:dofine/dsh-genui'

interface RunResult {
  status: number
  stdout: string
  /** Arguments the stubbed `dsh` received, one line per invocation. */
  calls: string
}

interface Env {
  root: string
  home: string
  run: (profile?: string, options?: { missing?: 'dsh' | 'pnpm' }) => RunResult
}

function makeEnv(installed: boolean): Env {
  const root = mkdtempSync(join(tmpdir(), 'genui-install-'))
  const home = join(root, 'dshhome')
  const logPath = join(root, 'dsh-calls.log')
  const bin = join(root, 'bin')
  const binNoDsh = join(root, 'bin-no-dsh')
  const binNoPnpm = join(root, 'bin-no-pnpm')
  for (const dir of [bin, binNoDsh, binNoPnpm]) mkdirSync(dir, { recursive: true })

  const dshStub = `#!/bin/sh\nprintf '%s\\n' "$*" >> "$DSH_STUB_LOG"\nexit 0\n`
  const pnpmStub = '#!/bin/sh\necho "11.7.0"\n'
  writeFileSync(join(bin, 'dsh'), dshStub)
  writeFileSync(join(bin, 'pnpm'), pnpmStub)
  writeFileSync(join(binNoDsh, 'pnpm'), pnpmStub)
  writeFileSync(join(binNoPnpm, 'dsh'), dshStub)
  for (const script of [join(bin, 'dsh'), join(bin, 'pnpm'), join(binNoDsh, 'pnpm'), join(binNoPnpm, 'dsh')]) {
    execFileSync('chmod', ['+x', script])
  }

  const profile = join(home, 'profiles', 'web')
  mkdirSync(profile, { recursive: true })
  const dependencies = installed ? '"dsh-genui-charts":"github:dofine/dsh-genui"' : ''
  writeFileSync(join(profile, 'package.json'), `{"name":"web","dependencies":{${dependencies}}}\n`)

  const run: Env['run'] = (profileArg = 'web', options = {}) => {
    // The stub directory is the ONLY PATH entry carrying `dsh`/`pnpm`, so the
    // "missing" cases cannot fall back to the host's real binaries.
    const stubPath = options.missing === 'dsh'
      ? binNoDsh
      : options.missing === 'pnpm' ? binNoPnpm : bin
    try {
      const stdout = execFileSync('/bin/sh', [INSTALL, profileArg], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${stubPath}:/usr/bin:/bin`, DSH_HOME: home, DSH_STUB_LOG: logPath },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { status: 0, stdout, calls: readCalls(logPath) }
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string }
      return { status: e.status ?? 1, stdout: `${e.stdout ?? ''}${e.stderr ?? ''}`, calls: readCalls(logPath) }
    }
  }
  return { root, home, run }
}

function readCalls(logPath: string): string {
  return existsSync(logPath) ? readFileSync(logPath, 'utf8') : ''
}

const active: Env[] = []

function env(installed = false): Env {
  const e = makeEnv(installed)
  active.push(e)
  return e
}

afterEach(() => {
  for (const e of active) rmSync(e.root, { recursive: true, force: true })
  active.length = 0
})

// Each case spawns a real shell (stub PATH + chmod + sh) at ~1s per run, so a
// suite-level timeout keeps CI deterministic under a fully parallel suite.
describe('install.sh: fork install path', { timeout: 30_000 }, () => {
  it('installs the GitHub source spec when the profile lacks the plugin', () => {
    const e = env()
    const { status, stdout, calls } = e.run()
    expect(status).toBe(0)
    expect(calls).toContain(`plugin --profile web add ${GITHUB_SPEC}`)
    expect(calls).not.toContain('link:')
    expect(stdout).toContain('安装完成')
  })

  it('passes the requested profile through', () => {
    const e = env()
    const { status, calls } = e.run('tui')
    expect(status).toBe(0)
    expect(calls).toContain(`plugin --profile tui add ${GITHUB_SPEC}`)
  })

  it('does not install again when the profile already lists the plugin', () => {
    const e = env(true)
    const { status, stdout, calls } = e.run()
    expect(status).toBe(0)
    expect(stdout).toContain('插件已在 profile')
    // Only the `dsh --version` prerequisite probe runs; no add/remove command.
    expect(calls).not.toContain('add ')
    expect(calls).not.toContain('remove ')
  })

  it('writes no skill files (the plugin registers SKILL.md itself)', () => {
    const e = env()
    const { status } = e.run()
    expect(status).toBe(0)
    expect(existsSync(join(e.home, 'skills'))).toBe(false)
  })
})

describe('install.sh: prerequisites and argument safety', { timeout: 30_000 }, () => {
  it('fails loudly when dsh is missing and installs nothing', () => {
    const e = env()
    const { status, stdout, calls } = e.run('web', { missing: 'dsh' })
    expect(status).not.toBe(0)
    expect(stdout).toContain('未找到 dsh 命令')
    expect(calls).toBe('')
  })

  it('fails loudly when pnpm is missing and installs nothing', () => {
    const e = env()
    const { status, stdout, calls } = e.run('web', { missing: 'pnpm' })
    expect(status).not.toBe(0)
    expect(stdout).toContain('未找到 pnpm')
    expect(calls).not.toContain('add ')
  })

  it('rejects an illegal profile name before doing anything', () => {
    const e = env()
    const { status, stdout, calls } = e.run('web; rm -rf /tmp/x')
    expect(status).not.toBe(0)
    expect(stdout).toContain('非法的 profile 名')
    expect(calls).toBe('')
  })

  it('rejects a profile name with path separators', () => {
    const e = env()
    expect(e.run('../evil').status).not.toBe(0)
  })
})
