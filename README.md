## Star the repo to help me out <3

## Documentation

This plugin is fully self-documented - every function in the source code includes comments explaining its purpose and behavior. Feel free to explore the code to understand exactly how it works.

## Contributing

This project is fully open source. You are encouraged to:
- Review the code
- Suggest improvements
- Submit pull requests
- Fork and modify for your own use

Your contributions are welcome and appreciated.

## Changelog

Version 1.4
- Auto-update now supports downgrades (reverting to older versions)
- Shows a "Restart Discord?" prompt after update with Yes/Cancel buttons
- Previous "Installing" modal closes automatically before showing the restart prompt
- Version comparison now supports any number of segments (1.2.3, 1.2.3.4, etc.)

Version 1.3
- Fixed CSP issue - version check now uses Node.js https from main process instead of renderer fetch
- Added retry logic for EBUSY errors on Windows during update
- Update in-place via git fetch + reset instead of delete + clone

Version 1.2
- Auto updates!

Version 1.1
- Made estimated time more accurate.
- Added rate limit easing(the closer you are to the rate limit the more it waits) in the plugin settings.
- Everything(anti log deletion, deletion, rate limit easing) now uses the interval in the plugin settings.
- Stability improvments.

## Credits

- **Anti-Logging Implementation** - Inspired by and adapted from [applefritter-inc/AntiLog](https://github.com/applefritter-inc/AntiLog). Special thanks to their team for making anti-logging deletion possible.
- **Vencord** - The Discord client mod that makes plugins like this possible.

## License

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
