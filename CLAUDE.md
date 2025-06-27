# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15.3 project using the App Router with TypeScript, Tailwind CSS v4, and React 19. The project uses Turbopack for development and includes shadcn/ui-style utilities for component styling.

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production application  
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Architecture

- **Framework**: Next.js with App Router (src/app directory)
- **Styling**: Tailwind CSS v4 with custom utility function in `src/lib/utils.ts`
- **Fonts**: Geist Sans and Geist Mono via next/font/google
- **Path Aliases**: `@/*` maps to `./src/*`

## Key Files

- `src/app/layout.tsx` - Root layout with font configuration
- `src/app/page.tsx` - Homepage component
- `src/lib/utils.ts` - Contains `cn()` utility for merging Tailwind classes using clsx and tailwind-merge

## Dependencies

The project includes shadcn/ui ecosystem packages (class-variance-authority, clsx, tailwind-merge, lucide-react) suggesting component-based UI development patterns.