from ._base import AndroidServiceBase


class AppLauncherNode(AndroidServiceBase):
    type = "appLauncher"
    display_name = "App Launcher"
    icon = "🚀"
    description = "Launch applications by package name"
