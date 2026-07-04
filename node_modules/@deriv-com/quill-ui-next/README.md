# Quill UI

## Development

Quill UI Next is a revolutionary component library that combines the power of Quill Design System with Figma Tokens and AI-driven development. Built for modern web applications, it offers a seamless bridge between design and development through automated code generation and intelligent implementations.

For a detailed overview of available components and their usage, please refer to our [Components Documentation](documents/components.md).

## Designers: Figma to React Export Guide

### Prerequisites
- Figma account with editor access
- [Locofy Plugin](https://www.locofy.ai/) installed in Figma

### Export Process
1. Open your Figma design
2. Select the components you want to export
3. Open Locofy plugin
4. Configure export settings:
   - Set export path to: `ai/components/`
   - Enable TypeScript
   - Select "React" as framework

### Important Guidelines
- Always export to `ai/components/` directory
- Name components with clear, descriptive names
- Ensure components follow Quill UI design system


### Code Review Process
1. Locofy will create a PR with the exported components
2. Developers will review and integrate the code
3. Components will be refactored to match Quill UI standards

## Key Features

- 🎨 **Figma-First Approach**: Components are designed in Figma and maintained using Design Tokens
- 🤖 **AI-Powered Generation**: Utilizes Locofy AI for accurate code translation from Figma designs
- 🔄 **Design Token Integration**: Seamless synchronization between design tokens and code
- 📦 **Modern Architecture**: Built with the latest web technologies and best practices
- 🛠 **Developer Enhanced**: AI-assisted development for complex functionalities and integrations



