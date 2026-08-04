import { spawn } from 'node:child_process'

/**
 * Trae al primer plano la ventana cuyo título contiene un texto (O10).
 *
 * Sirve para que, cuando una conversación termina o te reclama, la ventana de
 * su proyecto —la de VSCode, normalmente— te salte delante sin ir a buscarla.
 *
 * Cómo funciona, y por qué así:
 *
 *  - Se enumeran las ventanas visibles y se elige la que contiene el nombre
 *    del proyecto en el título. Si hay varias, gana la de Visual Studio Code:
 *    es donde viven las conversaciones.
 *  - Windows bloquea que un proceso en segundo plano robe el foco. El toque
 *    sintético de Alt (keybd_event) es el desbloqueo estándar; se comprobó en
 *    este mismo equipo que sin él la ventana solo parpadea y con él pasa al
 *    frente. Si aun así Windows lo bloquea, queda el parpadeo naranja en la
 *    barra — un aviso digno, no un fallo.
 *  - El texto a buscar viaja en una VARIABLE DE ENTORNO, nunca interpolado en
 *    el script: un nombre de carpeta con comillas o `$` no debe poder ejecutar
 *    nada (la misma razón por la que los hooks del proyecto usan forma directa).
 *
 * Limitación honesta: se enfoca la VENTANA del proyecto, no la pestaña exacta
 * de la conversación — VSCode no ofrece una puerta para eso (O10). Con dos
 * conversaciones del mismo proyecto, eliges pestaña tú.
 */

const SCRIPT = `
$frag = $env:TORRE_FOCUS_FRAGMENT
if (-not $frag) { exit 0 }
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class TorreWin {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder t, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
$script:mejor = [IntPtr]::Zero
$script:puntos = -1
$cb = {
  param($h, $l)
  if (-not [TorreWin]::IsWindowVisible($h)) { return $true }
  $sb = New-Object System.Text.StringBuilder 512
  [void][TorreWin]::GetWindowText($h, $sb, 512)
  $t = $sb.ToString()
  if ($t -and $t.ToLower().Contains($frag.ToLower())) {
    $p = 1
    if ($t -like '*Visual Studio Code*') { $p = 2 }
    if ($p -gt $script:puntos) { $script:mejor = $h; $script:puntos = $p }
  }
  return $true
}
[void][TorreWin]::EnumWindows($cb, [IntPtr]::Zero)
if ($script:mejor -ne [IntPtr]::Zero) {
  [TorreWin]::keybd_event(0xA4, 0x45, 1, [UIntPtr]::Zero)
  [TorreWin]::keybd_event(0xA4, 0x45, 3, [UIntPtr]::Zero)
  [void][TorreWin]::ShowWindowAsync($script:mejor, 9)
  [void][TorreWin]::SetForegroundWindow($script:mejor)
}
`

/**
 * Lanza el enfoque y sigue: es un gesto de cortesía, no una operación crítica.
 * Si PowerShell no está, el proceso muere o no hay ventana, no pasa nada — el
 * aviso del sistema ya salió, que es lo importante.
 */
export function focusProjectWindow(titleFragment: string): void {
  if (process.platform !== 'win32') return
  const fragmento = titleFragment.trim()
  if (!fragmento || fragmento.length > 200) return

  try {
    const hijo = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', SCRIPT],
      {
        env: { ...process.env, TORRE_FOCUS_FRAGMENT: fragmento },
        stdio: 'ignore',
        windowsHide: true,
        detached: true,
      },
    )
    hijo.unref()
  } catch {
    // Sin foco, pero con aviso. Suficiente.
  }
}
