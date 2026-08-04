/**
 * Offline fallback for the Back-end path curriculum.
 *
 * src/core.js scrapes the live path page first; this snapshot only takes over if
 * that page cannot be parsed, so the dashboard keeps working either way.
 * A JS module rather than JSON so it imports identically on Node and Workers.
 */

export default {
 "uuid": "16dfb1f2-6077-4cbc-b5e0-27ec1a298870",
 "slug": "backend-python-golang",
 "title": "Back-end Developer Path",
 "months": 12,
 "fetchedAt": "snapshot",
 "courses": [
  {
   "uuid": "f9a25dfb-3e00-4727-ac78-36de82315355",
   "slug": "learn-python-beginners",
   "title": "Learn Python for Beginners",
   "type": "Course",
   "lessons": 168,
   "hours": 30,
   "xp": 8000,
   "language": "python",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/zjjcJKZ.png",
   "blurb": "Start coding in Python with hands-on lessons that build the habits you'll use in every future course.",
   "chapters": [
    {
     "title": "Introduction",
     "lessons": 11
    },
    {
     "title": "Variables",
     "lessons": 16
    },
    {
     "title": "Functions",
     "lessons": 17
    },
    {
     "title": "Scope",
     "lessons": 3
    },
    {
     "title": "Testing and Debugging",
     "lessons": 6
    },
    {
     "title": "Computing",
     "lessons": 14
    },
    {
     "title": "Comparisons",
     "lessons": 13
    },
    {
     "title": "Loops",
     "lessons": 15
    },
    {
     "title": "Lists",
     "lessons": 24
    },
    {
     "title": "Dictionaries",
     "lessons": 11
    },
    {
     "title": "Sets",
     "lessons": 4
    },
    {
     "title": "Errors",
     "lessons": 9
    },
    {
     "title": "Type Hints",
     "lessons": 12
    },
    {
     "title": "Practice",
     "lessons": 9
    },
    {
     "title": "Quiz",
     "lessons": 4
    }
   ]
  },
  {
   "uuid": "bc7a07ef-ab87-42ab-80de-e7261f2c58a0",
   "slug": "learn-linux",
   "title": "Learn Linux",
   "type": "Course",
   "lessons": 66,
   "hours": 10,
   "xp": 4000,
   "language": "shell",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/U6Plt0N.png",
   "blurb": "Never fear a Linux terminal again. Navigate the filesystem, inspect processes, and automate everyday developer tasks.",
   "chapters": [
    {
     "title": "The Command Line",
     "lessons": 7
    },
    {
     "title": "Filesystems",
     "lessons": 17
    },
    {
     "title": "Programs",
     "lessons": 7
    },
    {
     "title": "Input/Output",
     "lessons": 9
    },
    {
     "title": "Local CLI",
     "lessons": 12
    },
    {
     "title": "Permissions",
     "lessons": 8
    },
    {
     "title": "Editors and Packages",
     "lessons": 6
    }
   ]
  },
  {
   "uuid": "094fd7d4-ec78-4202-96ca-c5f79fc332d2",
   "slug": "build-bookbot-python",
   "title": "Build a BookBot in Python",
   "type": "Guided Project",
   "lessons": 13,
   "hours": 6,
   "xp": 3000,
   "language": "python",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/CA96gmc.png",
   "blurb": "Build your first local command-line app and use the real tools developers use every day.",
   "chapters": [
    {
     "title": "Setup",
     "lessons": 4
    },
    {
     "title": "Data Analysis",
     "lessons": 6
    },
    {
     "title": "Report",
     "lessons": 3
    }
   ]
  },
  {
   "uuid": "933d6dd0-b21a-488e-8ece-469bbef28652",
   "slug": "learn-git",
   "title": "Learn Git",
   "type": "Course",
   "lessons": 64,
   "hours": 8,
   "xp": 5000,
   "language": "git",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/yBxOEfz.png",
   "blurb": "Don't be the developer that uses Git to simply add, commit, push, and pray. Learn how it works under the hood.",
   "chapters": [
    {
     "title": "Setup",
     "lessons": 6
    },
    {
     "title": "Repositories",
     "lessons": 6
    },
    {
     "title": "Internals",
     "lessons": 7
    },
    {
     "title": "Config",
     "lessons": 6
    },
    {
     "title": "Branching",
     "lessons": 8
    },
    {
     "title": "Merge",
     "lessons": 5
    },
    {
     "title": "Rebase",
     "lessons": 4
    },
    {
     "title": "Reset",
     "lessons": 4
    },
    {
     "title": "Remote",
     "lessons": 7
    },
    {
     "title": "GitHub",
     "lessons": 7
    },
    {
     "title": "Gitignore",
     "lessons": 4
    }
   ]
  },
  {
   "uuid": "f9a48bbc-d1ff-4388-bf0c-23c6e3c60ae0",
   "slug": "learn-object-oriented-programming-python",
   "title": "Learn Object Oriented Programming in Python",
   "type": "Course",
   "lessons": 47,
   "hours": 18,
   "xp": 5000,
   "language": "python",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/zjjcJKZ.png",
   "blurb": "Use classes when they help, skip the complexity when they don't, and learn OOP as a practical way to organize code.",
   "chapters": [
    {
     "title": "Clean Code",
     "lessons": 4
    },
    {
     "title": "Classes",
     "lessons": 11
    },
    {
     "title": "Encapsulation",
     "lessons": 6
    },
    {
     "title": "Abstraction",
     "lessons": 5
    },
    {
     "title": "Inheritance",
     "lessons": 11
    },
    {
     "title": "Polymorphism",
     "lessons": 10
    }
   ]
  },
  {
   "uuid": "b9d8cc18-455b-4531-b9ca-e134c7dba3df",
   "slug": "build-asteroids-python",
   "title": "Build Asteroids using Python and Pygame",
   "type": "Guided Project",
   "lessons": 20,
   "hours": 6,
   "xp": 4000,
   "language": "python",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/CA96gmc.png",
   "blurb": "Make a real arcade game while practicing OOP, vectors, collision detection, and game loops.",
   "chapters": [
    {
     "title": "Pygame",
     "lessons": 4
    },
    {
     "title": "Gameloop",
     "lessons": 4
    },
    {
     "title": "Player",
     "lessons": 5
    },
    {
     "title": "Asteroids",
     "lessons": 7
    }
   ]
  },
  {
   "uuid": "b1459f0c-21eb-41e5-b7f3-562ef69d344c",
   "slug": "learn-functional-programming-python",
   "title": "Learn Functional Programming in Python",
   "type": "Course",
   "lessons": 68,
   "hours": 22,
   "xp": 7000,
   "language": "python",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/zjjcJKZ.png",
   "blurb": "Add functional programming to your toolbox without pretending Python is Haskell.",
   "chapters": [
    {
     "title": "What is Functional Programming?",
     "lessons": 11
    },
    {
     "title": "First-Class Functions",
     "lessons": 9
    },
    {
     "title": "Pure Functions",
     "lessons": 11
    },
    {
     "title": "Recursion",
     "lessons": 10
    },
    {
     "title": "Function Transformations",
     "lessons": 5
    },
    {
     "title": "Closures",
     "lessons": 4
    },
    {
     "title": "Currying",
     "lessons": 5
    },
    {
     "title": "Decorators",
     "lessons": 7
    },
    {
     "title": "Sum Types",
     "lessons": 6
    }
   ]
  },
  {
   "uuid": "66c3d478-affc-4967-8171-bbc79b8e3cf1",
   "slug": "build-ai-agent-python",
   "title": "Build an AI Agent in Python",
   "type": "Guided Project",
   "lessons": 20,
   "hours": 12,
   "xp": 4000,
   "language": "python",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/CA96gmc.png",
   "blurb": "Build a tiny coding agent that can read files, edit code, run Python, and loop on feedback.\n",
   "chapters": [
    {
     "title": "LLMs",
     "lessons": 7
    },
    {
     "title": "Functions",
     "lessons": 6
    },
    {
     "title": "Function Calling",
     "lessons": 4
    },
    {
     "title": "Agents",
     "lessons": 3
    }
   ]
  },
  {
   "uuid": "7bbb53ed-2106-4f6b-b885-e7645c2ff9d8",
   "slug": "learn-data-structures-and-algorithms-python",
   "title": "Learn Data Structures and Algorithms in Python",
   "type": "Course",
   "lessons": 126,
   "hours": 32,
   "xp": 11000,
   "language": "python",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/zjjcJKZ.png",
   "blurb": "Build the data structures yourself, then use them to solve harder problems with less guessing.",
   "chapters": [
    {
     "title": "Algorithms Intro",
     "lessons": 4
    },
    {
     "title": "Math",
     "lessons": 11
    },
    {
     "title": "Big-O Analysis",
     "lessons": 10
    },
    {
     "title": "Sorting Algorithms",
     "lessons": 15
    },
    {
     "title": "Exponential Time",
     "lessons": 9
    },
    {
     "title": "Data Structures Intro",
     "lessons": 4
    },
    {
     "title": "Stacks",
     "lessons": 5
    },
    {
     "title": "Queues",
     "lessons": 4
    },
    {
     "title": "Linked Lists",
     "lessons": 8
    },
    {
     "title": "Binary Trees",
     "lessons": 12
    },
    {
     "title": "Red Black Trees",
     "lessons": 6
    },
    {
     "title": "Hashmaps",
     "lessons": 7
    },
    {
     "title": "Tries",
     "lessons": 8
    },
    {
     "title": "Graphs",
     "lessons": 6
    },
    {
     "title": "BFS and DFS",
     "lessons": 4
    },
    {
     "title": "P vs NP",
     "lessons": 13
    }
   ]
  },
  {
   "uuid": "d38e78e9-ae52-458e-8494-ec7ecbdab14f",
   "slug": "build-static-site-generator-python",
   "title": "Build a Static Site Generator in Python",
   "type": "Guided Project",
   "lessons": 26,
   "hours": 30,
   "xp": 6000,
   "language": "python",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/CA96gmc.png",
   "blurb": "Build the kind of tool that turns Markdown into a website, then understand static site generators from the inside.",
   "chapters": [
    {
     "title": "Static Sites",
     "lessons": 6
    },
    {
     "title": "Nodes",
     "lessons": 6
    },
    {
     "title": "Inline",
     "lessons": 5
    },
    {
     "title": "Blocks",
     "lessons": 3
    },
    {
     "title": "Website",
     "lessons": 6
    }
   ]
  },
  {
   "uuid": "8926592f-99b6-4398-a02f-f52e20677f64",
   "slug": "learn-memory-management-c",
   "title": "Learn Memory Management in C",
   "type": "Course",
   "lessons": 102,
   "hours": 24,
   "xp": 5000,
   "language": "c",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/leiue6x.png",
   "blurb": "Get close to the metal: pointers, the stack, the heap, and a tiny garbage collector you build yourself.\n",
   "chapters": [
    {
     "title": "C Basics",
     "lessons": 24
    },
    {
     "title": "Structs",
     "lessons": 6
    },
    {
     "title": "Pointers",
     "lessons": 17
    },
    {
     "title": "Enums",
     "lessons": 4
    },
    {
     "title": "Unions",
     "lessons": 4
    },
    {
     "title": "Stack and Heap",
     "lessons": 8
    },
    {
     "title": "Advanced Pointers",
     "lessons": 6
    },
    {
     "title": "Stack Data Structure",
     "lessons": 6
    },
    {
     "title": "Objects",
     "lessons": 10
    },
    {
     "title": "Refcounting GC",
     "lessons": 7
    },
    {
     "title": "Mark and Sweep GC",
     "lessons": 10
    }
   ]
  },
  {
   "uuid": "273215af-23f0-4461-a5d8-617c7f19127c",
   "slug": "build-personal-project-1",
   "title": "First Personal Project",
   "type": "Portfolio Project",
   "lessons": 4,
   "hours": 20,
   "xp": 5000,
   "language": "any",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/HPCv6fM.png",
   "blurb": "Pick an idea, scope it down, build it yourself, and get community feedback on the result.",
   "chapters": [
    {
     "title": "Placeholder",
     "lessons": 4
    }
   ]
  },
  {
   "uuid": "3b39d0f6-f944-4f1b-832d-a1daba32eda4",
   "slug": "learn-golang",
   "title": "Learn Go",
   "type": "Course",
   "lessons": 145,
   "hours": 20,
   "xp": 10000,
   "language": "go",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/7lhrwOp-256x256.png",
   "blurb": "Learn Go from the ground up: all the simple syntax, explicit errors, interfaces, and patterns you'll use to build real services.\n",
   "chapters": [
    {
     "title": "Variables",
     "lessons": 14
    },
    {
     "title": "Constants and Formatting",
     "lessons": 9
    },
    {
     "title": "Conditionals",
     "lessons": 4
    },
    {
     "title": "Functions",
     "lessons": 17
    },
    {
     "title": "Structs",
     "lessons": 10
    },
    {
     "title": "Interfaces",
     "lessons": 11
    },
    {
     "title": "Errors",
     "lessons": 7
    },
    {
     "title": "Loops",
     "lessons": 6
    },
    {
     "title": "Slices",
     "lessons": 13
    },
    {
     "title": "Maps",
     "lessons": 7
    },
    {
     "title": "Pointers",
     "lessons": 9
    },
    {
     "title": "Packages and Modules",
     "lessons": 13
    },
    {
     "title": "Channels",
     "lessons": 10
    },
    {
     "title": "Mutexes",
     "lessons": 5
    },
    {
     "title": "Generics",
     "lessons": 6
    },
    {
     "title": "Enums",
     "lessons": 3
    },
    {
     "title": "Quiz",
     "lessons": 1
    }
   ]
  },
  {
   "uuid": "323f2bff-0ba4-4ae9-b617-33bc5b2b7d79",
   "slug": "learn-http-clients-golang",
   "title": "Learn HTTP Clients in Go",
   "type": "Course",
   "lessons": 55,
   "hours": 14,
   "xp": 4000,
   "language": "go",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/7lhrwOp-256x256.png",
   "blurb": "Call real APIs, parse JSON, handle errors, and make HTTP feel boring in Go.",
   "chapters": [
    {
     "title": "Why HTTP?",
     "lessons": 9
    },
    {
     "title": "JSON",
     "lessons": 8
    },
    {
     "title": "DNS",
     "lessons": 5
    },
    {
     "title": "URIs",
     "lessons": 7
    },
    {
     "title": "Headers",
     "lessons": 4
    },
    {
     "title": "Methods",
     "lessons": 8
    },
    {
     "title": "Paths",
     "lessons": 5
    },
    {
     "title": "HTTPS",
     "lessons": 2
    },
    {
     "title": "Errors",
     "lessons": 2
    },
    {
     "title": "cURL",
     "lessons": 5
    }
   ]
  },
  {
   "uuid": "b6ac3462-d76f-453b-bd5d-5d7fe07cdadb",
   "slug": "build-pokedex-cli-golang",
   "title": "Build a Pokedex in Go",
   "type": "Guided Project",
   "lessons": 12,
   "hours": 24,
   "xp": 4000,
   "language": "go",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/fbuH9HC.png",
   "blurb": "Build a command-line Pokedex with a REPL, API calls, JSON parsing, and caching in Go.",
   "chapters": [
    {
     "title": "REPL",
     "lessons": 5
    },
    {
     "title": "Cache",
     "lessons": 5
    },
    {
     "title": "Pokedex",
     "lessons": 2
    }
   ]
  },
  {
   "uuid": "bc0dc34b-025a-4d97-b7a0-382aa21533aa",
   "slug": "learn-sql",
   "title": "Learn SQL",
   "type": "Course",
   "lessons": 95,
   "hours": 30,
   "xp": 5000,
   "language": "sql",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/TDs5Gpg.png",
   "blurb": "Get dangerous with relational databases: query, filter, join, and aggregate data without hiding behind an ORM.\n",
   "chapters": [
    {
     "title": "Introduction",
     "lessons": 7
    },
    {
     "title": "Tables",
     "lessons": 10
    },
    {
     "title": "Constraints",
     "lessons": 7
    },
    {
     "title": "CRUD",
     "lessons": 13
    },
    {
     "title": "Basic Queries",
     "lessons": 11
    },
    {
     "title": "Structuring",
     "lessons": 6
    },
    {
     "title": "Aggregations",
     "lessons": 10
    },
    {
     "title": "Subqueries",
     "lessons": 5
    },
    {
     "title": "Normalization",
     "lessons": 11
    },
    {
     "title": "Joins",
     "lessons": 10
    },
    {
     "title": "Performance",
     "lessons": 5
    }
   ]
  },
  {
   "uuid": "3a8d6b13-c064-424d-bd09-5e09ceaddfea",
   "slug": "build-blog-aggregator-golang",
   "title": "Build a Blog Aggregator in Go",
   "type": "Guided Project",
   "lessons": 18,
   "hours": 24,
   "xp": 4000,
   "language": "go",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/fbuH9HC.png",
   "blurb": "Build an RSS-powered Go backend with a database, background work, and a real API shape.",
   "chapters": [
    {
     "title": "Config",
     "lessons": 3
    },
    {
     "title": "Database",
     "lessons": 5
    },
    {
     "title": "RSS",
     "lessons": 3
    },
    {
     "title": "Following",
     "lessons": 3
    },
    {
     "title": "Aggregate",
     "lessons": 4
    }
   ]
  },
  {
   "uuid": "81b7293c-60aa-40c7-a158-7c87428f6031",
   "slug": "learn-http-servers-golang",
   "title": "Learn HTTP Servers in Go",
   "type": "Course",
   "lessons": 51,
   "hours": 24,
   "xp": 5000,
   "language": "go",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/7lhrwOp-256x256.png",
   "blurb": "Build the server side of the web: routes, middleware, auth, and APIs in Go.\n",
   "chapters": [
    {
     "title": "Servers",
     "lessons": 10
    },
    {
     "title": "Routing",
     "lessons": 4
    },
    {
     "title": "Architecture",
     "lessons": 4
    },
    {
     "title": "JSON",
     "lessons": 4
    },
    {
     "title": "Storage",
     "lessons": 10
    },
    {
     "title": "Authentication",
     "lessons": 9
    },
    {
     "title": "Authorization",
     "lessons": 3
    },
    {
     "title": "Webhooks",
     "lessons": 3
    },
    {
     "title": "Documentation",
     "lessons": 4
    }
   ]
  },
  {
   "uuid": "189c4b36-0a42-4211-ae03-7938550c5b57",
   "slug": "learn-file-servers-s3-cloudfront-golang",
   "title": "Learn File Servers and CDNs with S3 and CloudFront",
   "type": "Course",
   "lessons": 43,
   "hours": 24,
   "xp": 5000,
   "language": "go",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/7lhrwOp-256x256.png",
   "blurb": "Store and serve user files like a Go backend developer: S3, CloudFront, streaming, and secure access.\n",
   "chapters": [
    {
     "title": "File Storage",
     "lessons": 9
    },
    {
     "title": "Caching",
     "lessons": 4
    },
    {
     "title": "AWS S3",
     "lessons": 6
    },
    {
     "title": "Object Storage",
     "lessons": 3
    },
    {
     "title": "Video Streaming",
     "lessons": 4
    },
    {
     "title": "Security",
     "lessons": 7
    },
    {
     "title": "CDNs",
     "lessons": 5
    },
    {
     "title": "Resiliency",
     "lessons": 5
    }
   ]
  },
  {
   "uuid": "2d740eb6-3234-419e-9a23-08ec9e9889b7",
   "slug": "learn-docker",
   "title": "Learn Docker",
   "type": "Course",
   "lessons": 43,
   "hours": 18,
   "xp": 4000,
   "language": "docker",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/IaVNfLY.png",
   "blurb": "Understand Docker by actually using it: images, containers, volumes, networks, and why teams ship with it.\n",
   "chapters": [
    {
     "title": "Install",
     "lessons": 4
    },
    {
     "title": "Containers",
     "lessons": 5
    },
    {
     "title": "Storage",
     "lessons": 7
    },
    {
     "title": "Execute",
     "lessons": 4
    },
    {
     "title": "Networks",
     "lessons": 6
    },
    {
     "title": "Dockerfiles",
     "lessons": 7
    },
    {
     "title": "Debug",
     "lessons": 4
    },
    {
     "title": "Publish",
     "lessons": 6
    }
   ]
  },
  {
   "uuid": "93174165-cfaf-4201-a5b6-7da1864c9792",
   "slug": "learn-pub-sub-rabbitmq-golang",
   "title": "Learn Pub/Sub in RabbitMQ and Go",
   "type": "Course",
   "lessons": 37,
   "hours": 32,
   "xp": 5000,
   "language": "go",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/x45S6DA.png",
   "blurb": "Build event-driven backend flows with RabbitMQ, not just another request-response API.",
   "chapters": [
    {
     "title": "Pub/Sub Architecture",
     "lessons": 4
    },
    {
     "title": "Message Brokers",
     "lessons": 5
    },
    {
     "title": "Publishers & Queues",
     "lessons": 9
    },
    {
     "title": "Subscribers & Routing",
     "lessons": 4
    },
    {
     "title": "Delivery",
     "lessons": 6
    },
    {
     "title": "Serialization",
     "lessons": 4
    },
    {
     "title": "Scalability",
     "lessons": 5
    }
   ]
  },
  {
   "uuid": "25a0e482-fd55-463c-80b6-4fbf789fcef5",
   "slug": "build-capstone-project",
   "title": "Capstone Project",
   "type": "Portfolio Project",
   "lessons": 3,
   "hours": 50,
   "xp": 6000,
   "language": "any",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/HPCv6fM.png",
   "blurb": "Build your strongest portfolio project, then turn it into resume and interview material.",
   "chapters": [
    {
     "title": "Placeholder",
     "lessons": 3
    }
   ]
  },
  {
   "uuid": "0617f271-09a6-4b1c-ab59-d0ec22f53153",
   "slug": "learn-job-search",
   "title": "Learn How to Find a Programming Job",
   "type": "Course",
   "lessons": 52,
   "hours": 12,
   "xp": 2000,
   "language": "any",
   "thumb": "https://storage.googleapis.com/qvault-webapp-dynamic-assets/course_assets/IJ8L74S.png",
   "blurb": "Turn your projects into proof, your resume into a signal, and your job search into something less random.",
   "chapters": [
    {
     "title": "Strategy",
     "lessons": 4
    },
    {
     "title": "Projects",
     "lessons": 8
    },
    {
     "title": "GitHub Profile",
     "lessons": 5
    },
    {
     "title": "Resume",
     "lessons": 10
    },
    {
     "title": "LinkedIn Profile",
     "lessons": 3
    },
    {
     "title": "Applying",
     "lessons": 4
    },
    {
     "title": "Networking",
     "lessons": 5
    },
    {
     "title": "Interviewing",
     "lessons": 9
    },
    {
     "title": "Relocation",
     "lessons": 4
    }
   ]
  }
 ]
};
