Your task is to build a UI/UX Proof of Concept (PoC) for a next-generation, visual-first Internal Developer Platform (IDP). The goal of this PoC is not functional backend integration, but purely to showcase the UI/UX and serve as a starting point for design reasoning. All data should be hardcoded.

## Philosophy

Humans lives in a 3D world, and interact with 2D screen. So it's better to take advantage of this two dimensional reasoning model when trying to inspect and manage a complex systems with lot of interaction. This IDP is an attempt to follow human intuitiveness for navigating through a spatial canvas where the entire system is laid out as components with connection between them, representing messages, data, traces. flowing inwards and outwards of them.

Moreover, it's possible to exploit also the third dimension by using a concept of layers, stacked on top of each other, representing different modes of viewing this system. They do not need to be overlaying each other, as the avoidance of any particular cumbersome situation is imperative, but the UI could simply suggest that they live in a third dimension.

Finally it's important to underline the difficulty of humans to deal with more than one thing at a time. That is way it's critical that users are able to remove the noise and focus on what's important. That is why this platform will have the ability to zoom into a component and enter in its perspective. For example, when zooming into a microservice, break it down to its single features, so that when tracing a bug, you can identify more clearly which team own the feature that is broke. This is one, but not the only way to incentivize the ability to focus the user on the important stuff.

Simplicity is the ultimate sophistication.

## Tech Stack

- React
- Vite 
- Tanstack Router
- React Flow
- Bun
- Tailwind CSS 4
- shadcn/ui

## Core Features & Requirements

The Interactive Canvas: a full-screen React Flow canvas. Custom styled nodes (representing microservices, databases, queues, etc.) and custom edges.

Persona-Based Layers: Implement an intuitive way to allows the user to switch between different "Layers" or "Views" of the canvas. Changing the layer should update the visual state of the nodes and edges using the hardcoded data.

Tracing Layer (SWE Persona): Focus on debugging. Highlight specific paths/edges to simulate data flowing through a feature. Clearly visualize a "broken" node or connection where computation failed (e.g., using red error states, warning icons).

Building Layer (PO/PM Persona): Focus on design and backlogging. Make the UI feel like a blueprint. Show "draft" or ghost nodes and edges representing projected components. Include an intuitive interactivity feature to be able to create new components, change and delete existing one. 

Platform Engineer Layer (DevOps Persona): Focus on infrastructure and health. Show metrics on the nodes (e.g., CPU, memory, deployment status, hardcoded health checks).

Code Quality: Write clean, modular, and highly extendable code. Separate your mock data from your UI components. Create distinct React components for your custom React Flow nodes so they can be easily modified later.
