// Deterministic generator for Benchmark V2.
// Course texts are hand-authored synthetic scenarios; labels are derived from
// the scenario metadata. No LLM or external service is used.
import { writeFile } from "node:fs/promises";

const modules = [
  {
    id: "MATH",
    name: "Linear Algebra",
    required_ects: 9,
    description:
      "Vector spaces, matrices, systems of linear equations, determinants, eigenvalues, eigenvectors, orthogonality and matrix decompositions.",
  },
  {
    id: "STAT",
    name: "Probability and Statistics",
    required_ects: 6,
    description:
      "Random variables, probability distributions, conditional probability, expectation, statistical estimation, confidence intervals, hypothesis testing and regression.",
  },
  {
    id: "CS",
    name: "Algorithms and Data Structures",
    required_ects: 9,
    description:
      "Arrays, linked lists, stacks, queues, trees, graphs and hash tables; sorting, searching, graph traversal, dynamic programming and asymptotic complexity analysis.",
  },
  {
    id: "DATA",
    name: "Database Systems",
    required_ects: 6,
    description:
      "Relational data modeling, entity-relationship design, SQL queries, normalization, transactions, indexing and query optimization.",
  },
  {
    id: "ML",
    name: "Machine Learning",
    required_ects: 6,
    description:
      "Supervised classification and regression, feature engineering, model selection, cross-validation, regularization and evaluation of generalization.",
  },
  {
    id: "SE",
    name: "Software Engineering",
    required_ects: 6,
    description:
      "Requirements analysis, modular and object-oriented design, version control, unit and integration testing, agile teamwork and software maintenance.",
  },
  {
    id: "NET",
    name: "Computer Networks",
    required_ects: 6,
    description:
      "Layered network architectures, packet switching, routing, TCP/IP, congestion control, wireless networks and network measurement.",
  },
  {
    id: "OS",
    name: "Operating Systems",
    required_ects: 6,
    description:
      "Processes and threads, CPU scheduling, synchronization, deadlock, virtual memory, file systems, concurrency and system calls.",
  },
  {
    id: "SEC",
    name: "Cybersecurity",
    required_ects: 6,
    description:
      "Cryptographic primitives, authentication and access control, threat modeling, software vulnerabilities, secure protocols and incident response.",
  },
  {
    id: "CV",
    name: "Computer Vision",
    required_ects: 6,
    description:
      "Image formation and filtering, feature detection, camera geometry, stereo vision, object recognition, convolutional neural networks and visual scene understanding.",
  },
  {
    id: "NLP",
    name: "Natural Language Processing",
    required_ects: 6,
    description:
      "Text normalization, tokenization, language models, word and sentence embeddings, syntactic parsing, machine translation and transformer architectures.",
  },
  {
    id: "HCI",
    name: "Human-Computer Interaction",
    required_ects: 6,
    description:
      "Interaction design, usability principles, prototyping, user studies, accessibility, evaluation methods and human factors in interface development.",
  },
  {
    id: "DIST",
    name: "Distributed Systems",
    required_ects: 6,
    description:
      "Replication, consistency models, consensus, fault tolerance, distributed transactions, message passing and scalable system design.",
  },
  {
    id: "CLOUD",
    name: "Cloud Computing",
    required_ects: 6,
    description:
      "Virtualization, containers, orchestration, elastic resource management, cloud storage, serverless computing and deployment automation.",
  },
  {
    id: "GRAPH",
    name: "Computer Graphics",
    required_ects: 6,
    description:
      "Rasterization, geometric transformations, shading models, texture mapping, ray tracing, animation and real-time rendering pipelines.",
  },
  {
    id: "EMB",
    name: "Embedded Systems",
    required_ects: 6,
    description:
      "Microcontroller architectures, C programming, interrupts, real-time scheduling, sensor interfaces, embedded communication and hardware-software co-design.",
  },
  {
    id: "THEO",
    name: "Theoretical Computer Science",
    required_ects: 6,
    description:
      "Finite automata, formal languages, Turing machines, computability, decidability and computational complexity classes.",
  },
  {
    id: "NUM",
    name: "Numerical Methods",
    required_ects: 6,
    description:
      "Floating-point arithmetic, numerical linear algebra, iterative solvers, interpolation, numerical integration, stability and error analysis.",
  },
  {
    id: "ROB",
    name: "Robotics",
    required_ects: 6,
    description:
      "Robot kinematics, dynamics, motion planning, control, sensor fusion, localization and perception for autonomous systems.",
  },
  {
    id: "ETH",
    name: "Computing Ethics and Law",
    required_ects: 6,
    description:
      "Professional responsibility, privacy, algorithmic bias, intellectual property, data protection regulation and social impacts of computing.",
  },
];

const courses = [
  // ----- Development: straightforward (10) -----
  {
    id: "D001",
    split: "dev",
    name: "Linear Algebra I",
    credits: 4,
    scenario: "straightforward",
    targetModuleId: "MATH",
    description:
      "Vector spaces and linear maps. Matrix operations, systems of linear equations, determinants, eigenvalues and eigenvectors. Students compute matrix factorizations and apply orthogonality in geometric problems.",
  },
  {
    id: "D002",
    split: "dev",
    name: "Probability Theory",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "STAT",
    description:
      "Random variables, discrete and continuous probability distributions, conditional probability, expectation and variance. Students derive sampling distributions and apply the law of large numbers.",
  },
  {
    id: "D003",
    split: "dev",
    name: "Algorithms and Data Structures",
    credits: 6,
    scenario: "straightforward",
    targetModuleId: "CS",
    description:
      "Arrays, linked lists, stacks, queues, trees, graphs and hash tables. Sorting, searching, graph traversal, dynamic programming and asymptotic time and space complexity.",
  },
  {
    id: "D004",
    split: "dev",
    name: "Introduction to Databases",
    credits: 4,
    scenario: "straightforward",
    targetModuleId: "DATA",
    description:
      "Relational data modeling and entity-relationship design. SQL queries, joins, normalization, transactions, indexing and query optimization in a practical database project.",
  },
  {
    id: "D005",
    split: "dev",
    name: "Machine Learning Fundamentals",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "ML",
    description:
      "Supervised classification and regression with linear models, decision trees and ensembles. Feature engineering, model selection, cross-validation, regularization and generalization evaluation.",
  },
  {
    id: "D006",
    split: "dev",
    name: "Software Engineering I",
    credits: 4,
    scenario: "straightforward",
    targetModuleId: "SE",
    description:
      "Requirements analysis and object-oriented modular design. Version control, unit and integration testing, agile team development and software maintenance.",
  },
  {
    id: "D007",
    split: "dev",
    name: "Computer Networks",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "NET",
    description:
      "Layered network architectures and packet switching. Routing algorithms, TCP/IP, congestion control, wireless networks and hands-on network measurement.",
  },
  {
    id: "D008",
    split: "dev",
    name: "Operating Systems",
    credits: 6,
    scenario: "straightforward",
    targetModuleId: "OS",
    description:
      "Processes, threads and CPU scheduling. Synchronization, deadlock, virtual memory, file systems and system calls, with concurrency programming assignments.",
  },
  {
    id: "D009",
    split: "dev",
    name: "Computer Vision Basics",
    credits: 4,
    scenario: "straightforward",
    targetModuleId: "CV",
    description:
      "Image formation, filtering and feature detection. Camera geometry, stereo vision, object recognition and convolutional neural networks for visual scene understanding.",
  },
  {
    id: "D010",
    split: "dev",
    name: "Natural Language Processing",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "NLP",
    description:
      "Text normalization, tokenization and language models. Word and sentence embeddings, syntactic parsing, machine translation and transformer architectures.",
  },

  // ----- Development: paraphrase / terminology variation (10) -----
  {
    id: "D011",
    split: "dev",
    name: "Matrix Methods for Engineers",
    credits: 4,
    scenario: "paraphrase",
    targetModuleId: "MATH",
    description:
      "Lineare Algebra für Ingenieure: Vektorräume, lineare Gleichungssysteme, Matrizen und Determinanten. Students analyze eigenvalues, eigenvectors and orthogonal transformations in engineering models.",
  },
  {
    id: "D012",
    split: "dev",
    name: "Statistical Data Analysis",
    credits: 4,
    scenario: "paraphrase",
    targetModuleId: "STAT",
    description:
      "Exploratory analysis and inferential reasoning with random variables and probability models. Students estimate parameters, construct confidence intervals and test hypotheses using regression.",
  },
  {
    id: "D013",
    split: "dev",
    name: "Efficient Programming",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "CS",
    description:
      "Algorithmic problem solving with arrays, lists, stacks, queues, trees, graphs and hash maps. Students compare sorting and search strategies and reason about running-time growth.",
  },
  {
    id: "D014",
    split: "dev",
    name: "Relational Information Systems",
    credits: 4,
    scenario: "paraphrase",
    targetModuleId: "DATA",
    description:
      "Designing relational schemata from entity-relationship models. Students write SQL joins, normalize tables, manage concurrent transactions and tune indexes for query performance.",
  },
  {
    id: "D015",
    split: "dev",
    name: "Learning from Data",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "ML",
    description:
      "Statistical learning for prediction and classification. Students train regularized models, select features, run cross-validation and evaluate generalization on held-out data.",
  },
  {
    id: "D016",
    split: "dev",
    name: "Building Reliable Software",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "SE",
    description:
      "Requirements elicitation, modular architecture and object-oriented design. Teams use version control, write unit and integration tests and maintain an agile software project.",
  },
  {
    id: "D017",
    split: "dev",
    name: "Networked Systems",
    credits: 4,
    scenario: "paraphrase",
    targetModuleId: "NET",
    description:
      "Packet-switched communication, layered protocols and internet routing. Students analyze TCP/IP behavior, congestion control and wireless network performance.",
  },
  {
    id: "D018",
    split: "dev",
    name: "System Software",
    credits: 6,
    scenario: "paraphrase",
    targetModuleId: "OS",
    description:
      "Betriebssysteme: Prozesse, Threads und Scheduling; Synchronisation, Verklemmung und virtueller Speicher. Students implement system calls, file-system operations and concurrent programs.",
  },
  {
    id: "D019",
    split: "dev",
    name: "Digital Image Understanding",
    credits: 4,
    scenario: "paraphrase",
    targetModuleId: "CV",
    description:
      "Pixels, filters and feature descriptors for visual recognition. Students study camera projection, stereo matching, object detection and convolutional networks for scene interpretation.",
  },
  {
    id: "D020",
    split: "dev",
    name: "Language Technologies",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "NLP",
    description:
      "Computational processing of natural language: tokenization, language modeling, embeddings and parsing. Students build translation and transformer-based text analysis pipelines.",
  },

  // ----- Development: partial relevance (8) -----
  {
    id: "D021",
    split: "dev",
    name: "Introduction to Probability",
    credits: 3,
    scenario: "partial",
    targetModuleId: "STAT",
    description:
      "Random variables, discrete and continuous distributions and conditional probability. The course does not cover statistical estimation, confidence intervals or hypothesis testing.",
  },
  {
    id: "D022",
    split: "dev",
    name: "Data Structures",
    credits: 3,
    scenario: "partial",
    targetModuleId: "CS",
    description:
      "Arrays, linked lists, stacks, queues and binary search trees, with basic sorting. Graph algorithms, dynamic programming and asymptotic complexity analysis are not covered.",
  },
  {
    id: "D023",
    split: "dev",
    name: "SQL and Database Design",
    credits: 4,
    scenario: "partial",
    targetModuleId: "DATA",
    description:
      "Entity-relationship modeling, SQL queries, joins and normalization. Transactions, indexing and query optimization are outside the course scope.",
  },
  {
    id: "D024",
    split: "dev",
    name: "Supervised Learning",
    credits: 4,
    scenario: "partial",
    targetModuleId: "ML",
    description:
      "Linear and logistic regression, decision trees and basic feature engineering. Model selection, cross-validation, regularization and generalization analysis are not covered.",
  },
  {
    id: "D025",
    split: "dev",
    name: "Software Testing",
    credits: 3,
    scenario: "partial",
    targetModuleId: "SE",
    description:
      "Unit testing, integration testing, test-case design and automated test execution. Requirements analysis, architecture and team project management are outside the scope.",
  },
  {
    id: "D026",
    split: "dev",
    name: "Web Application Security",
    credits: 4,
    scenario: "partial",
    targetModuleId: "SEC",
    description:
      "Web vulnerabilities such as injection, cross-site scripting and broken authentication, with secure coding exercises. Cryptography, access-control theory and threat modeling are not covered.",
  },
  {
    id: "D027",
    split: "dev",
    name: "Usability Evaluation",
    credits: 3,
    scenario: "partial",
    targetModuleId: "HCI",
    description:
      "User studies, interviews, questionnaires and usability testing with basic statistical summaries. Interaction design, prototyping and accessibility standards are not covered.",
  },
  {
    id: "D028",
    split: "dev",
    name: "Introduction to Rendering",
    credits: 3,
    scenario: "partial",
    targetModuleId: "GRAPH",
    description:
      "Rasterization, geometric transformations and basic shading in a real-time pipeline. Texture mapping, ray tracing, animation and advanced rendering are not covered.",
  },

  // ----- Development: hard negatives (8) -----
  // Each hard-negative course has one genuine match and one lexically similar
  // decoy module that is explicitly not covered.
  {
    id: "D029",
    split: "dev",
    name: "Statistical Methods for Finance",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "STAT",
    decoyModuleId: "MATH",
    description:
      "Statistical analysis of financial returns: probability distributions, volatility estimation, regression and hypothesis tests for portfolio risk. Matrix notation is used for covariance tables, but vector spaces, determinants, eigenvalues, eigenvectors and matrix decompositions are not taught.",
  },
  {
    id: "D030",
    split: "dev",
    name: "Data Visualization",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "HCI",
    decoyModuleId: "DATA",
    description:
      "Designing charts, dashboards and visual encodings for end users. Students run usability tests, accessibility reviews and interaction evaluations of data interfaces. Relational database design, SQL joins, normalization, transactions and indexing are not covered.",
  },
  {
    id: "D031",
    split: "dev",
    name: "Scientific Computing in Python",
    credits: 3,
    scenario: "hard_negative",
    targetModuleId: "NUM",
    decoyModuleId: "CS",
    description:
      "Python for numerical simulation: floating-point error, interpolation, numerical integration, stability and iterative linear solvers. Scripts use lists and loops, but data structures, algorithm analysis, graph algorithms and complexity theory are not taught.",
  },
  {
    id: "D032",
    split: "dev",
    name: "Digital Marketing Analytics",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "STAT",
    decoyModuleId: "ML",
    description:
      "Statistical analysis of marketing experiments: randomization, sampling, confidence intervals, hypothesis tests and regression for conversion rates. Dashboard tools are used, but machine learning, feature engineering, model selection, cross-validation and regularization are not covered.",
  },
  {
    id: "D033",
    split: "dev",
    name: "Professional Practice in Software Teams",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "ETH",
    decoyModuleId: "SE",
    description:
      "Professional responsibility, privacy and ethical decision-making in software teams. Students discuss case studies of failures and bias while using project schedules and agile ceremonies. Requirements engineering, software architecture, programming, version control and testing are not covered.",
  },
  {
    id: "D034",
    split: "dev",
    name: "Computing, Ethics and Society",
    credits: 3,
    scenario: "hard_negative",
    targetModuleId: "ETH",
    decoyModuleId: "CS",
    description:
      "Social and ethical impacts of computing: privacy, bias, professional responsibility and technology policy. Students read historical case studies of digital systems. Programming, algorithms, data structures and complexity analysis are not taught.",
  },
  {
    id: "D035",
    split: "dev",
    name: "Embedded Control in Medical Devices",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "EMB",
    decoyModuleId: "CV",
    description:
      "Embedded control and sensor interfaces in medical imaging devices: microcontrollers, interrupts, calibration, real-time constraints and serial communication. Students operate X-ray and ultrasound hardware. Image processing, feature detection, camera geometry and computer vision models are not covered.",
  },
  {
    id: "D036",
    split: "dev",
    name: "Data Protection and Compliance",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "ETH",
    decoyModuleId: "SEC",
    description:
      "Data protection regulation, privacy law, contracts and compliance audits. Students review security policies and incident reports, but cryptography, authentication, access control, threat modeling and secure coding are not covered.",
  },

  // ----- Development: no valid match (4) -----
  {
    id: "D037",
    split: "dev",
    name: "Renaissance Art History",
    credits: 3,
    scenario: "no_valid_match",
    description:
      "Painting, sculpture and architecture in fifteenth-century Italy. Students analyze patronage, perspective and visual symbolism in primary sources and museum collections.",
  },
  {
    id: "D038",
    split: "dev",
    name: "World Literature",
    credits: 3,
    scenario: "no_valid_match",
    description:
      "Comparative readings of epic, novel and drama across cultures. Students examine narrative voice, translation and historical context in seminar discussions and essays.",
  },
  {
    id: "D039",
    split: "dev",
    name: "Music Theory",
    credits: 3,
    scenario: "no_valid_match",
    description:
      "Scales, intervals, harmony, counterpoint and musical form. Students analyze scores, complete voice-leading exercises and compose short tonal pieces.",
  },
  {
    id: "D040",
    split: "dev",
    name: "Environmental Economics",
    credits: 4,
    scenario: "no_valid_match",
    description:
      "Externalities, public goods, pollution pricing and cost-benefit analysis. Students evaluate environmental policy instruments using microeconomic models and case studies.",
  },

  // ----- Test: straightforward (15) -----
  {
    id: "T001",
    split: "test",
    name: "Linear Algebra II",
    credits: 4,
    scenario: "straightforward",
    targetModuleId: "MATH",
    description:
      "Abstract vector spaces, linear transformations, change of basis, inner products, determinants and spectral theory. Students prove matrix decomposition results and solve applied linear systems.",
  },
  {
    id: "T002",
    split: "test",
    name: "Statistical Inference",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "STAT",
    description:
      "Probability distributions, random variables, parameter estimation, confidence intervals, hypothesis testing and regression analysis. Students derive estimators and interpret inferential results.",
  },
  {
    id: "T003",
    split: "test",
    name: "Data Structures and Algorithms",
    credits: 6,
    scenario: "straightforward",
    targetModuleId: "CS",
    description:
      "Abstract data types and their implementations: dynamic arrays, linked lists, stacks, queues, priority queues, balanced search trees, disjoint sets, graphs and hash tables. Students analyze sorting, graph traversal and shortest-path algorithms using recurrence relations and asymptotic bounds.",
  },
  {
    id: "T004",
    split: "test",
    name: "Database Systems",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "DATA",
    description:
      "Relational modeling, entity-relationship design, SQL, normalization, transactions, indexing and query optimization. Students implement and tune a relational database application.",
  },
  {
    id: "T005",
    split: "test",
    name: "Machine Learning",
    credits: 6,
    scenario: "straightforward",
    targetModuleId: "ML",
    description:
      "Supervised classification and regression, feature engineering, model selection, cross-validation, regularization and evaluation of generalization on held-out data.",
  },
  {
    id: "T006",
    split: "test",
    name: "Software Engineering",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "SE",
    description:
      "Lifecycle models for dependable software: stakeholder requirements, architecture, modular decomposition, configuration management and quality assurance. Students plan iterations, review code, automate regression tests and deliver a maintainable team project.",
  },
  {
    id: "T007",
    split: "test",
    name: "Internet Protocols and Routing",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "NET",
    description:
      "Host-to-host communication across heterogeneous networks. Students examine Ethernet framing, IP addressing, route selection, transport handshakes, queueing delay and wireless link behavior through packet traces.",
  },
  {
    id: "T008",
    split: "test",
    name: "Operating System Design",
    credits: 6,
    scenario: "straightforward",
    targetModuleId: "OS",
    description:
      "Kernel abstractions for execution and storage: process creation, thread scheduling, mutual exclusion, deadlock avoidance, paging, memory mapping and persistent file organization. Labs implement synchronization and system-call interfaces.",
  },
  {
    id: "T009",
    split: "test",
    name: "Cybersecurity Fundamentals",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "SEC",
    description:
      "Cryptographic primitives, authentication and access control, threat modeling, software vulnerabilities, secure protocols and incident response.",
  },
  {
    id: "T010",
    split: "test",
    name: "Vision Systems",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "CV",
    description:
      "Recovering scene structure from images and video. Topics include sensor models, convolution, edge and corner detection, projective geometry, epipolar constraints, region segmentation, object detection and learned visual representations.",
  },
  {
    id: "T011",
    split: "test",
    name: "Text and Speech Processing",
    credits: 6,
    scenario: "straightforward",
    targetModuleId: "NLP",
    description:
      "Algorithms for human language data: character and subword segmentation, statistical and neural language modeling, distributed word representations, sequence labeling, attention and encoder-decoder translation. Students train and evaluate text pipelines.",
  },
  {
    id: "T012",
    split: "test",
    name: "Human-Computer Interaction",
    credits: 4,
    scenario: "straightforward",
    targetModuleId: "HCI",
    description:
      "Interaction design, usability principles, prototyping, user studies, accessibility, evaluation methods and human factors in interface development.",
  },
  {
    id: "T013",
    split: "test",
    name: "Distributed Systems",
    credits: 6,
    scenario: "straightforward",
    targetModuleId: "DIST",
    description:
      "Replication, consistency models, consensus, fault tolerance, distributed transactions, message passing and scalable system design.",
  },
  {
    id: "T014",
    split: "test",
    name: "Cloud Computing",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "CLOUD",
    description:
      "Virtualization, containers, orchestration, elastic resource management, cloud storage, serverless computing and deployment automation.",
  },
  {
    id: "T015",
    split: "test",
    name: "Computer Graphics",
    credits: 5,
    scenario: "straightforward",
    targetModuleId: "GRAPH",
    description:
      "Rasterization, geometric transformations, shading models, texture mapping, ray tracing, animation and real-time rendering pipelines.",
  },

  // ----- Test: paraphrase / terminology variation (15) -----
  {
    id: "T016",
    split: "test",
    name: "Matrix Analysis and Applications",
    credits: 4,
    scenario: "paraphrase",
    targetModuleId: "MATH",
    description:
      "Eigenvalue problems, singular-value decompositions and least-squares systems. Students apply orthogonality, matrix norms and linear transformations to data and engineering models.",
  },
  {
    id: "T017",
    split: "test",
    name: "Probability and Random Processes",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "STAT",
    description:
      "Random variables, distributions and stochastic processes. Students apply conditional probability, expectation, variance, estimation and hypothesis tests to noisy observations.",
  },
  {
    id: "T018",
    split: "test",
    name: "Algorithm Design",
    credits: 6,
    scenario: "paraphrase",
    targetModuleId: "CS",
    description:
      "Design and analysis of efficient procedures using lists, trees, graphs and hash maps. Students compare divide-and-conquer, greedy and dynamic-programming strategies by running-time growth.",
  },
  {
    id: "T019",
    split: "test",
    name: "Data Management Systems",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "DATA",
    description:
      "Storage and retrieval of structured records with relational schemas. Students write SQL, normalize relations, manage concurrent updates and optimize indexes for query workloads.",
  },
  {
    id: "T020",
    split: "test",
    name: "Statistical Learning",
    credits: 6,
    scenario: "paraphrase",
    targetModuleId: "ML",
    description:
      "Predictive modeling from labeled data with regularized linear models, trees and ensembles. Students tune features, run cross-validation and assess generalization error.",
  },
  {
    id: "T021",
    split: "test",
    name: "Software Construction",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "SE",
    description:
      "Eliciting requirements, designing modular object-oriented systems and maintaining code over time. Teams practice version control, automated unit and integration tests and iterative delivery.",
  },
  {
    id: "T022",
    split: "test",
    name: "Internetworking and Transport",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "NET",
    description:
      "Design of interconnected networks and reliable data delivery. Students study addressing, forwarding, routing convergence, transport flow control, retransmission, wireless access and traffic measurement.",
  },
  {
    id: "T023",
    split: "test",
    name: "Kernel Programming Laboratory",
    credits: 6,
    scenario: "paraphrase",
    targetModuleId: "OS",
    description:
      "Hands-on kernel-level programming: interrupt handling, device drivers, memory-mapped I/O, process isolation, scheduling policies and persistent storage. Students build small modules and debug races with tracing tools.",
  },
  {
    id: "T024",
    split: "test",
    name: "Applied Cryptography",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "SEC",
    description:
      "Encryption, authentication, key exchange and access control. Students analyze secure protocols, threat models and common implementation vulnerabilities.",
  },
  {
    id: "T025",
    split: "test",
    name: "Visual Computing",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "CV",
    description:
      "Images, filters and geometric vision. Students implement feature detection, stereo matching, object recognition and convolutional networks for scene understanding.",
  },
  {
    id: "T026",
    split: "test",
    name: "Computational Linguistics",
    credits: 6,
    scenario: "paraphrase",
    targetModuleId: "NLP",
    description:
      "Language modeling, tokenization, embeddings and syntactic analysis. Students build machine-translation and transformer-based text-processing pipelines.",
  },
  {
    id: "T027",
    split: "test",
    name: "Interaction Design",
    credits: 4,
    scenario: "paraphrase",
    targetModuleId: "HCI",
    description:
      "Designing usable interfaces through prototypes, user studies and accessibility review. Students evaluate interaction flows and human factors with qualitative and quantitative methods.",
  },
  {
    id: "T028",
    split: "test",
    name: "Reliable Distributed Computing",
    credits: 6,
    scenario: "paraphrase",
    targetModuleId: "DIST",
    description:
      "Fault-tolerant replication, consistency models, consensus and distributed transactions. Students design scalable message-passing systems and analyze failure scenarios.",
  },
  {
    id: "T029",
    split: "test",
    name: "Virtualized Infrastructure",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "CLOUD",
    description:
      "Virtual machines, containers and orchestration for elastic deployments. Students automate resource allocation, storage and serverless workloads.",
  },
  {
    id: "T030",
    split: "test",
    name: "Real-Time Rendering",
    credits: 5,
    scenario: "paraphrase",
    targetModuleId: "GRAPH",
    description:
      "Rasterization, shading, texture mapping and ray tracing for interactive graphics. Students implement animation and real-time rendering pipelines.",
  },

  // ----- Test: partial relevance (12) -----
  {
    id: "T031",
    split: "test",
    name: "Introduction to Statistics",
    credits: 3,
    scenario: "partial",
    targetModuleId: "STAT",
    description:
      "Random variables, probability distributions, descriptive statistics and correlation. Parameter estimation, confidence intervals and hypothesis testing are not covered.",
  },
  {
    id: "T032",
    split: "test",
    name: "Programming with Python",
    credits: 3,
    scenario: "partial",
    targetModuleId: "CS",
    description:
      "Variables, loops, functions, lists and dictionaries in Python. The course does not cover algorithm analysis, graph algorithms, dynamic programming or complexity theory.",
  },
  {
    id: "T033",
    split: "test",
    name: "Relational Databases",
    credits: 4,
    scenario: "partial",
    targetModuleId: "DATA",
    description:
      "Relational schemas, SQL queries, joins and normalization. Transactions, indexing and query optimization are outside the course scope.",
  },
  {
    id: "T034",
    split: "test",
    name: "Neural Networks",
    credits: 4,
    scenario: "partial",
    targetModuleId: "ML",
    description:
      "Feed-forward networks, backpropagation and gradient descent for classification. Model selection, cross-validation, regularization and generalization analysis are not covered.",
  },
  {
    id: "T035",
    split: "test",
    name: "Requirements Engineering",
    credits: 3,
    scenario: "partial",
    targetModuleId: "SE",
    description:
      "Elicitation, specification, prioritization and validation of software requirements. Architecture, implementation, testing and team project management are not covered.",
  },
  {
    id: "T036",
    split: "test",
    name: "Network Security",
    credits: 4,
    scenario: "partial",
    targetModuleId: "SEC",
    description:
      "Firewalls, intrusion detection and secure network configuration. Cryptography, access-control theory, threat modeling and incident response are not covered.",
  },
  {
    id: "T037",
    split: "test",
    name: "Web Development",
    credits: 3,
    scenario: "partial",
    targetModuleId: "HCI",
    description:
      "HTML, CSS and basic JavaScript for static pages. The course introduces simple layout and navigation but does not cover usability studies, accessibility standards or interaction design.",
  },
  {
    id: "T038",
    split: "test",
    name: "Microcontroller Programming",
    credits: 4,
    scenario: "partial",
    targetModuleId: "EMB",
    description:
      "GPIO, timers and serial communication on a microcontroller in C. Real-time scheduling, sensor fusion and hardware-software co-design are not covered.",
  },
  {
    id: "T039",
    split: "test",
    name: "Automata and Formal Languages",
    credits: 4,
    scenario: "partial",
    targetModuleId: "THEO",
    description:
      "Finite automata, regular expressions and context-free grammars. Turing machines, computability, decidability and complexity classes are not covered.",
  },
  {
    id: "T040",
    split: "test",
    name: "Numerical Linear Algebra",
    credits: 4,
    scenario: "partial",
    targetModuleId: "NUM",
    description:
      "Matrix factorizations and iterative solvers for linear systems. Interpolation, numerical integration and stability analysis are not covered.",
  },
  {
    id: "T041",
    split: "test",
    name: "Robot Kinematics",
    credits: 4,
    scenario: "partial",
    targetModuleId: "ROB",
    description:
      "Forward and inverse kinematics, homogeneous transforms and workspace analysis. Dynamics, motion planning, control and perception are not covered.",
  },
  {
    id: "T042",
    split: "test",
    name: "Technology Ethics",
    credits: 3,
    scenario: "partial",
    targetModuleId: "ETH",
    description:
      "Privacy, algorithmic bias and professional responsibility in computing. Data-protection law, intellectual property and formal compliance auditing are not covered.",
  },

  // ----- Test: hard negatives (12) -----
  {
    id: "T043",
    split: "test",
    name: "Empirical Finance",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "STAT",
    decoyModuleId: "MATH",
    description:
      "Empirical finance with statistical models: heavy-tailed return distributions, maximum-likelihood estimation, bootstrap confidence intervals and regression diagnostics. Matrix operations are limited to spreadsheet covariance tables; vector spaces, eigenvalues and linear algebra proofs are not covered.",
  },
  {
    id: "T044",
    split: "test",
    name: "Analytics Dashboard Usability",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "HCI",
    decoyModuleId: "DATA",
    description:
      "Usability of analytics dashboards: information layout, visual hierarchy, accessibility and task-based user testing. Students prototype dashboard interactions and evaluate comprehension. SQL query tuning, relational modeling, normalization, transactions and indexing are not covered.",
  },
  {
    id: "T045",
    split: "test",
    name: "Numerical Spreadsheet Models",
    credits: 3,
    scenario: "hard_negative",
    targetModuleId: "NUM",
    decoyModuleId: "DATA",
    description:
      "Spreadsheet models for numerical estimation: interpolation, root finding, numerical integration and error propagation. Students build what-if calculators and pivot summaries. Relational databases, SQL joins, normalization, transactions and statistical hypothesis testing are not covered.",
  },
  {
    id: "T046",
    split: "test",
    name: "Photographic Color and Tone",
    credits: 3,
    scenario: "hard_negative",
    targetModuleId: "GRAPH",
    decoyModuleId: "CV",
    description:
      "Color science and image post-processing for photography: tone mapping, gamma correction, texture appearance and display calibration. Students edit photographic images. Feature detection, camera geometry, stereo matching and object recognition are not covered.",
  },
  {
    id: "T047",
    split: "test",
    name: "Usability Documentation",
    credits: 3,
    scenario: "hard_negative",
    targetModuleId: "HCI",
    decoyModuleId: "SE",
    description:
      "Writing user-facing documentation, help pages and accessibility guidance. Students run usability reviews, revise instructions and test comprehension with users. Requirements engineering, software architecture, programming, version control and automated testing are not covered.",
  },
  {
    id: "T048",
    split: "test",
    name: "Embedded Hardware Diagnostics",
    credits: 3,
    scenario: "hard_negative",
    targetModuleId: "EMB",
    decoyModuleId: "OS",
    description:
      "Embedded hardware diagnostics: power rails, microcontrollers, interrupts, serial buses, sensor calibration and firmware installation. Students troubleshoot device boards. Operating-system internals, process scheduling, virtual memory, file systems and system-call implementation are not covered.",
  },
  {
    id: "T049",
    split: "test",
    name: "Social Media Measurement",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "STAT",
    decoyModuleId: "ML",
    description:
      "Statistical analysis of social-media engagement: sampling, confidence intervals, hypothesis tests and regression for audience metrics. Students use platform dashboards and text reports. Machine learning, feature engineering, model selection, cross-validation and natural-language processing are not covered.",
  },
  {
    id: "T050",
    split: "test",
    name: "Game Experience Design",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "HCI",
    decoyModuleId: "GRAPH",
    description:
      "Playtesting, interaction design and player experience. Students prototype game interfaces, run usability studies and evaluate accessibility. Rasterization, shading, texture mapping, ray tracing and rendering pipelines are not covered.",
  },
  {
    id: "T051",
    split: "test",
    name: "Desktop Systems Administration",
    credits: 3,
    scenario: "hard_negative",
    targetModuleId: "OS",
    decoyModuleId: "NET",
    description:
      "Desktop operating-system administration: user accounts, file permissions, process troubleshooting, system updates and storage management. Students diagnose connectivity with basic tools. Network protocol design, routing algorithms, congestion control and distributed systems are not covered.",
  },
  {
    id: "T052",
    split: "test",
    name: "Biological Database Querying",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "DATA",
    decoyModuleId: "CS",
    description:
      "Querying biological databases: relational schemas, SQL joins, normalization, data cleaning and indexing for sequence and expression records. Students use command-line tools and web platforms. Algorithm design, data-structure implementation, graph algorithms and complexity analysis are not covered.",
  },
  {
    id: "T053",
    split: "test",
    name: "Online Store Compliance",
    credits: 4,
    scenario: "hard_negative",
    targetModuleId: "ETH",
    decoyModuleId: "SE",
    description:
      "Consumer protection, privacy policy and regulatory compliance for online stores. Students review payment workflows and analytics dashboards. Software engineering, requirements analysis, software architecture, database implementation and distributed systems are not covered.",
  },
  {
    id: "T054",
    split: "test",
    name: "Algorithmic Fairness and Society",
    credits: 3,
    scenario: "hard_negative",
    targetModuleId: "ETH",
    decoyModuleId: "ML",
    description:
      "Algorithmic fairness and accountability: bias, privacy, transparency and technology regulation. Students analyze case studies of automated decision-making. Machine-learning training, feature engineering, cross-validation, statistical estimation and hypothesis testing are not covered.",
  },

  // ----- Test: no valid match (6) -----
  {
    id: "T055",
    split: "test",
    name: "Classical Philosophy",
    credits: 3,
    scenario: "no_valid_match",
    description:
      "Readings in Plato, Aristotle and Hellenistic ethics. Students analyze arguments about knowledge, virtue and political community in seminars and essays.",
  },
  {
    id: "T056",
    split: "test",
    name: "Urban Sociology",
    credits: 3,
    scenario: "no_valid_match",
    description:
      "City growth, gentrification, housing policy and social inequality. Students conduct neighborhood observations and critique urban planning case studies.",
  },
  {
    id: "T057",
    split: "test",
    name: "Sculpture Workshop",
    credits: 3,
    scenario: "no_valid_match",
    description:
      "Modeling, carving and assemblage with clay, wood and mixed media. Students develop form, texture and spatial composition through studio projects and critiques.",
  },
  {
    id: "T058",
    split: "test",
    name: "Financial Accounting",
    credits: 4,
    scenario: "no_valid_match",
    description:
      "Journal entries, ledgers, financial statements and accrual accounting. Students prepare balance sheets and income statements for small businesses.",
  },
  {
    id: "T059",
    split: "test",
    name: "Nutrition Science",
    credits: 4,
    scenario: "no_valid_match",
    description:
      "Macronutrients, micronutrients, digestion and dietary requirements. Students evaluate nutrition evidence and design balanced meal plans.",
  },
  {
    id: "T060",
    split: "test",
    name: "Film Studies",
    credits: 3,
    scenario: "no_valid_match",
    description:
      "Film form, genre, editing and spectatorship. Students analyze sequences and write critical essays on cinema history and visual style.",
  },
];

const moduleById = new Map(modules.map((m) => [m.id, m]));
const scenarioKeys = [
  "straightforward",
  "paraphrase",
  "partial",
  "hard_negative",
  "no_valid_match",
];

function decisionFor(course, moduleId) {
  if (
    (course.scenario === "straightforward" ||
      course.scenario === "paraphrase" ||
      course.scenario === "hard_negative") &&
    moduleId === course.targetModuleId
  )
    return "match";
  if (course.scenario === "partial" && moduleId === course.targetModuleId)
    return "partial";
  return "no_match";
}

function rationaleFor(course, moduleId, decision) {
  if (decision === "match")
    return "The course description and learning outcomes substantially cover the target module's required topics.";
  if (decision === "partial")
    return "The course covers some target topics but explicitly omits important required content; relevant but incomplete.";
  if (
    course.scenario === "hard_negative" &&
    moduleId === course.decoyModuleId
  )
    return "Superficial lexical overlap only; the course explicitly focuses on a different domain and does not substantively cover this module.";
  return "The documented course scope does not substantively address this target module.";
}

function validateInputs() {
  const ids = new Set();
  for (const course of courses) {
    if (ids.has(course.id)) throw new Error(`Duplicate course ID ${course.id}`);
    ids.add(course.id);
    if (!["dev", "test"].includes(course.split))
      throw new Error(`Invalid split for ${course.id}`);
    if (!scenarioKeys.includes(course.scenario))
      throw new Error(`Invalid scenario for ${course.id}`);
    if (
      ["straightforward", "paraphrase", "partial", "hard_negative"].includes(
        course.scenario,
      ) &&
      !moduleById.has(course.targetModuleId)
    )
      throw new Error(`Missing target module for ${course.id}`);
    if (
      course.scenario === "hard_negative" &&
      !moduleById.has(course.decoyModuleId)
    )
      throw new Error(`Missing decoy module for ${course.id}`);
    if (
      course.scenario === "hard_negative" &&
      course.targetModuleId === course.decoyModuleId
    )
      throw new Error(`Hard-negative target and decoy must differ for ${course.id}`);
  }
  const dev = courses.filter((c) => c.split === "dev");
  const test = courses.filter((c) => c.split === "test");
  if (dev.length !== 40 || test.length !== 60)
    throw new Error(`Split counts must be 40/60, got ${dev.length}/${test.length}`);
  if (new Set(modules.map((m) => m.id)).size !== 20)
    throw new Error("Benchmark V2 requires 20 unique modules");
  const counts = Object.fromEntries(scenarioKeys.map((k) => [k, 0]));
  for (const c of courses) counts[c.scenario]++;
  const expected = {
    straightforward: 25,
    paraphrase: 25,
    partial: 20,
    hard_negative: 20,
    no_valid_match: 10,
  };
  for (const key of scenarioKeys)
    if (counts[key] !== expected[key])
      throw new Error(
        `Scenario ${key} expected ${expected[key]}, got ${counts[key]}`,
      );
  const labelCount = courses.length * modules.length;
  if (labelCount !== 2000)
    throw new Error(`Expected 2000 labels, got ${labelCount}`);
}

validateInputs();

const outputCourses = courses.map((course) => ({
  id: course.id,
  split: course.split,
  name: course.name,
  description: course.description,
  credits: course.credits,
  scenario: course.scenario,
  ...(course.targetModuleId
    ? { targetModuleId: course.targetModuleId }
    : {}),
  ...(course.decoyModuleId ? { decoyModuleId: course.decoyModuleId } : {}),
}));

const labels = outputCourses.flatMap((course) =>
  modules.map((module) => {
    const decision = decisionFor(course, module.id);
    return {
      courseId: course.id,
      moduleId: module.id,
      decision,
      rationale: rationaleFor(course, module.id, decision),
    };
  }),
);

const scenarioPolicy = {
  straightforward: {
    share: 0.25,
    definition:
      "The course description closely mirrors the target module description and explicit learning outcomes.",
    labelRule: "Target module = match; every other module = no_match.",
  },
  paraphrase: {
    share: 0.25,
    definition:
      "The course covers the same content using synonyms, alternative terminology, or mixed German/English vocabulary.",
    labelRule: "Target module = match; every other module = no_match.",
  },
  partial: {
    share: 0.2,
    definition:
      "The course covers a proper subset of the target module and explicitly omits important required topics.",
    labelRule:
      "Target module = partial; every other module = no_match. Partial means content relevance, not partial credit allocation.",
  },
  hard_negative: {
    share: 0.2,
    definition:
      "The course has one genuine target match but also shares vocabulary with a decoy module that it explicitly does not cover, making lexical overlap misleading.",
    labelRule:
      "Target module = match; the decoy module and every other module = no_match. Decoy module is recorded in decoyModuleId for analysis only.",
  },
  no_valid_match: {
    share: 0.1,
    definition:
      "The course belongs to a non-computing or unrelated domain and has no substantive overlap with any target module.",
    labelRule: "Every module = no_match.",
  },
};

const data = {
  version: 2,
  benchmark: "Benchmark V2",
  provenance:
    "Synthetic benchmark authored for this project with a deterministic generator. NOT real university data and NOT independently human-validated. Labels follow the documented classification criteria; review before using them for model selection.",
  synthetic: true,
  humanValidated: false,
  generatedBy: "eval/data/generate-v2.mjs",
  generation:
    "Hand-authored course scenarios expanded deterministically into a complete course-module label matrix. No LLM, external API, or paid service is used.",
  splitPolicy:
    "40 development courses (D001-D040) and 60 disjoint test courses (T001-T060). Development data may be used for pipeline sanity checks; test data is reserved for final evaluation. Do not tune labels or thresholds on the test split.",
  relevanceDefinition:
    "A module is relevant to a course when its ground-truth decision is match or partial. Courses with no match/partial label are excluded from Recall@K, HitRate@K and MRR denominators, matching the existing retrievalMetrics implementation.",
  scenarioPolicy,
  labelingCriteria: {
    match:
      "The documented course content and learning outcomes substantially cover the target module's required topics; relevance is judged on substance, not keyword overlap.",
    partial:
      "A proper subset of the target module is covered and important required topics are explicitly absent. This is retrieval relevance and does not imply partial credit allocation.",
    no_match:
      "The documented content does not substantively cover the module. Hard negatives deliberately share vocabulary while lacking substantive coverage.",
    ambiguityPolicy:
      "Cross-domain courses that share terminology with a module are labeled no_match when the substantive requirements are absent. Decoy modules for hard negatives are recorded in course metadata to make this decision auditable.",
  },
  modules,
  courses: outputCourses,
  labels,
};

await writeFile(
  new URL("./benchmark-v2.json", import.meta.url),
  JSON.stringify(data, null, 2) + "\n",
);
console.log(
  `Wrote benchmark-v2.json: ${outputCourses.length} courses, ${modules.length} modules, ${labels.length} labels`,
);
