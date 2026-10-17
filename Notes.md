## Major Changes
* Add Linux support (community driven)
* Add mod hotkeys/toggles editor
* Add scaling and blur slider settings
* Add an option to turn off all animations
* Add an option to adjust/crop preview images in app
* Add support for concurrent download at the same time
* Add 7zip support for significantly faster and reliable archive extraction

## Minor Changes
* Implement local mod data caching for faster mod loading
* Improved game switch alert while downloads are active
* Sanitize GB injected html (mod data and comments)
* Sanitize category names
* Add target selector when trying to update a mod where multiple mods locally have the same source
* Add an option to backup inis before updating a mod
* Add drag & drop for preview images
* Add drag & drop for preview archives
* Add an option to paste Images or URL to set preview images
* Check for collisions before mod installs
* Optimize mod dir structure with better file naming and folder structure

## Patches
* Fix mod 'updatedAt' values not being changed correctly
* Fix broken mod installations for some users
* Handle archive pwd protect error
* Handle edge cases in installing from local archives
* Handle preferences for multiple namespace correctly
* Increase max hot key search depth to infinity
* Change tauri port to avoid conflict with internal windows port
* UI changes to right side bar to increases hot key display area
* UI changes to latest updates view (online mode)
* General performance optimizations