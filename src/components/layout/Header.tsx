import { Box, Moon, Sun, Monitor, LogOut } from 'lucide-react'
import { Button } from '../ui/button'
import { useTheme } from '../../hooks/useTheme'
import { authApi } from '../../services/api'

export function Header(): React.ReactElement {
  const { theme, setTheme } = useTheme()

  const cycleTheme = (): void => {
    const modes: Array<typeof theme> = ['system', 'light', 'dark']
    const currentIndex = modes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % modes.length
    const nextTheme = modes[nextIndex]
    if (nextTheme) {
      setTheme(nextTheme)
    }
  }

  const getThemeIcon = (): React.ReactElement => {
    if (theme === 'system') return <Monitor className="h-5 w-5" />
    if (theme === 'light') return <Sun className="h-5 w-5" />
    return <Moon className="h-5 w-5" />
  }

  const handleHomeClick = (): void => {
    window.location.href = '/'
  }

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <button
          onClick={handleHomeClick}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer text-left"
        >
          <Box className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Durable Object Manager</h1>
            <p className="text-sm text-muted-foreground">
              Manage your Cloudflare Durable Objects
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            title={`Theme: ${theme}`}
          >
            {getThemeIcon()}
          </Button>
          <Button variant="outline" onClick={() => authApi.logout()}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}

