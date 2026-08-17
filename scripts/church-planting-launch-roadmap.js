const task = (title, description, options = {}) => ({
  title,
  description,
  task_type:'task',
  is_required:true,
  requires_approval:false,
  participant_editable:true,
  default_priority:3,
  tags:[],
  ...options
});

const milestone = (title, description, options = {}) => task(title, description, {
  task_type:'milestone',
  participant_editable:false,
  default_priority:1,
  ...options
});

const group = (title, description, tasks, options = {}) => ({
  title,
  description,
  task_type:'group',
  is_required:true,
  requires_approval:false,
  participant_editable:true,
  default_priority:3,
  tags:[],
  tasks,
  ...options
});

module.exports = {
  template:{
    title:'Church Planting Launch Roadmap',
    slug:'church-planting-launch-roadmap',
    description:'A customizable CMC roadmap that helps a pioneer and regional leader move from an affirmed call through launch, stabilization, and a growing culture of multiplication.',
    stage_key:'deploy',
    status:'published',
    version:2
  },
  sections:[
    {
      title:'Phase 1 · Discern and Align',
      description:'Confirm calling, readiness, relationships, and alignment before building a launch plan.',
      tasks:[
        group('Affirm the call', 'Clarify the pioneer’s calling, capacity, and current readiness with trusted leaders.', [
          task('Write a personal calling statement', 'Describe the people or place you feel called to serve, why church planting may be the right response, and what has brought clarity so far.', { relative_due_days:14, default_priority:1, tags:['calling'] }),
          task('Discuss the calling with your spouse or household', 'If applicable, talk honestly about expectations, risks, family health, finances, and the support needed for the journey.', { relative_due_days:21, tags:['family'] }),
          task('Invite feedback from trusted ministry leaders', 'Ask two or three mature leaders to speak candidly about your character, gifting, leadership, and readiness.', { relative_due_days:28, tags:['calling','feedback'] }),
          task('Complete assigned CMC discernment work', 'Finish the assessments, application, and references assigned by your regional leader.', { relative_due_days:42, default_priority:2, tags:['assessment'] }),
          task('Review discernment findings with your regional leader', 'Identify strengths, growth areas, risks, and the next development steps together.', { relative_due_days:49, requires_approval:true, participant_editable:false, default_priority:1, tags:['assessment','review'] })
        ]),
        group('Establish support and coaching', 'Build the relationships that will provide accountability, care, and practical guidance.', [
          task('Identify your primary CMC regional leader', 'Confirm who will provide regional oversight and who should be contacted when decisions or concerns arise.', { relative_due_days:14, participant_editable:false, tags:['oversight'] }),
          task('Select an approved church planting coach', 'Work with your regional leader to choose a coach with relevant ministry and multiplication experience.', { relative_due_days:35, requires_approval:true, tags:['coaching'] }),
          task('Agree on the coaching relationship', 'Set expectations for confidentiality, frequency, preparation, accountability, and duration.', { relative_due_days:42, tags:['coaching'] }),
          task('Schedule recurring coaching meetings', 'Place a dependable meeting rhythm on both calendars and decide how progress will be reviewed.', { relative_due_days:49, tags:['coaching'] }),
          task('Create a personal and family care plan', 'Name healthy rhythms, trusted support, boundaries, and warning signs that require attention.', { relative_due_days:56, tags:['health','family'] })
        ]),
        group('Listen to the community', 'Learn the people, stories, needs, assets, and spiritual landscape of the proposed mission field.', [
          task('Define the initial ministry area', 'Name the city, neighborhood, network, or people group being explored. This can be refined later.', { relative_due_days:21, tags:['community'] }),
          task('Review demographic and community information', 'Study population, growth, languages, ages, economics, mobility, and other factors relevant to ministry.', { relative_due_days:35, tags:['community','research'] }),
          task('Interview local leaders and residents', 'Listen to educators, nonprofit leaders, business owners, pastors, and residents before proposing solutions.', { relative_due_days:49, tags:['community','listening'] }),
          task('Prayer-walk and observe the area', 'Pray, notice gathering places and rhythms, and record questions, opportunities, and signs of God’s activity.', { relative_due_days:56, tags:['prayer','community'] }),
          task('Summarize the ministry opportunity', 'Describe who you hope to serve, what you have learned, existing community assets, and the gaps a new church could faithfully address.', { relative_due_days:63, requires_approval:true, tags:['community','review'] })
        ]),
        group('Confirm Open Bible alignment', 'Clarify denominational relationship, oversight, and the expectations for moving forward.', [
          task('Review CMC and Open Bible multiplication commitments', 'Discuss the biblical convictions, relationships, accountability, and multiplication practices expected of a CMC pioneer.', { relative_due_days:28, tags:['open-bible','alignment'] }),
          task('Clarify the Open Bible affiliation pathway', 'With your regional leader, identify the applicable credentialing, affiliation, chartering, governance, and reporting steps.', { relative_due_days:49, requires_approval:true, participant_editable:false, tags:['open-bible','governance'] }),
          task('Name the initial oversight structure', 'Document who provides spiritual, financial, legal, and ministry accountability before a local board is formed.', { relative_due_days:56, requires_approval:true, tags:['governance'] }),
          task('Set a provisional launch window', 'Choose a realistic season rather than a fixed public date until readiness has been reviewed.', { relative_due_days:63, tags:['timeline'] }),
          milestone('Phase 1 readiness review', 'The pioneer, coach, and regional leader agree on whether to proceed, pause for development, or revise the plan.', { relative_due_days:70, requires_approval:true, tags:['approval','milestone'] })
        ])
      ]
    },
    {
      title:'Phase 2 · Form the Foundation',
      description:'Shape the ministry, prayer, team, financial, and administrative foundations that support a healthy launch.',
      tasks:[
        group('Clarify mission and ministry model', 'Translate the calling and community learning into a focused ministry direction.', [
          task('Draft the church’s mission', 'Write a clear statement of who the church is called to serve and what it exists to do.', { relative_due_days:84, tags:['vision'] }),
          task('Define core values and ministry convictions', 'Name the behaviors and biblical commitments that will guide leadership, discipleship, mission, and multiplication.', { relative_due_days:98, tags:['vision','culture'] }),
          task('Outline a disciple-making pathway', 'Describe how people will encounter Jesus, grow as disciples, serve, lead, and participate in mission.', { relative_due_days:105, tags:['discipleship'] }),
          task('Choose an initial church planting model', 'Define the likely approach, such as neighborhood, network, house church, multisite, or public gathering, and explain why it fits the context.', { relative_due_days:112, tags:['model'] }),
          task('Review the ministry foundation with your coach', 'Test the mission, values, disciple-making pathway, and model for clarity and alignment.', { relative_due_days:119, requires_approval:true, tags:['vision','review'] })
        ]),
        group('Build prayer and core-team support', 'Develop spiritual support and begin forming a healthy, aligned team.', [
          task('Create an intercessory prayer plan', 'Set a rhythm for prayer requests, updates, confidentiality, and celebration.', { relative_due_days:84, tags:['prayer'] }),
          task('Recruit an initial prayer team', 'Invite people who will pray consistently for the pioneer, family, team, and community.', { relative_due_days:105, tags:['prayer','team'] }),
          task('Define the first core-team profile', 'Describe the character, commitment, gifting, and cultural fit needed on the initial team.', { relative_due_days:112, tags:['team'] }),
          task('Invite and interview potential core-team members', 'Share the vision, listen to their calling, and avoid promising roles before alignment is clear.', { relative_due_days:140, tags:['team','recruiting'] }),
          task('Adopt a core-team covenant', 'Agree on spiritual health, conduct, communication, conflict, safeguarding, generosity, and participation.', { relative_due_days:154, requires_approval:true, tags:['team','culture'] })
        ]),
        group('Build the financial plan', 'Create transparent, accountable plans for launch funding and sustainable ministry.', [
          task('Draft the launch budget', 'Estimate one-time expenses, phased purchases, contingencies, and the funding needed before launch.', { relative_due_days:98, tags:['finance'] }),
          task('Draft a first-year operating budget', 'Estimate conservative income and recurring ministry, staffing, facility, insurance, and administrative expenses.', { relative_due_days:112, tags:['finance'] }),
          task('Confirm regional financial requirements', 'Ask the regional leader which approvals, accounts, controls, reporting, and fundraising practices are required.', { relative_due_days:119, requires_approval:true, participant_editable:false, tags:['finance','open-bible'] }),
          task('Create a funding strategy', 'Identify potential sending churches, partners, personal support, grants, and earned or congregational income without assuming every source will materialize.', { relative_due_days:126, tags:['finance','fundraising'] }),
          task('Set up donor communication and tracking', 'Choose a simple, secure way to record commitments, gifts, restrictions, acknowledgments, and regular updates.', { relative_due_days:147, tags:['finance','fundraising'] }),
          task('Approve the launch and operating budgets', 'The appropriate regional leader or oversight group reviews assumptions, controls, and financial viability.', { relative_due_days:161, requires_approval:true, participant_editable:false, default_priority:1, tags:['finance','approval'] })
        ]),
        group('Establish administration and risk safeguards', 'Put proportionate legal, financial, safety, and data practices in place with qualified guidance.', [
          task('Confirm the legal and organizational pathway', 'Follow the direction of Open Bible regional leadership and qualified legal or tax professionals before creating entities or filing government forms.', { relative_due_days:105, requires_approval:true, participant_editable:false, tags:['legal','open-bible'] }),
          task('Establish banking, bookkeeping, and financial controls', 'Use approved accounts, separation of duties, expense documentation, and regular financial reporting.', { relative_due_days:140, requires_approval:true, tags:['finance','governance'] }),
          task('Confirm insurance coverage', 'Review general liability, property, workers’ compensation, pastoral, abuse and molestation, vehicle, cyber, and event coverage as applicable.', { relative_due_days:154, requires_approval:true, tags:['risk','insurance'] }),
          task('Adopt safeguarding and background-check practices', 'Document how children, vulnerable people, volunteers, records, incidents, and mandated reporting will be handled.', { relative_due_days:168, requires_approval:true, tags:['safety','policy'] }),
          task('Create a secure records and privacy practice', 'Limit access to personal, pastoral, donor, financial, and background-check information and define retention responsibilities.', { relative_due_days:175, tags:['privacy','administration'] })
        ]),
        group('Create essential communication systems', 'Build only the identity and communication tools needed for this stage.', [
          task('Confirm the church name', 'Check ministry fit, regional approval, domain availability, and likely conflicts before investing in a brand.', { relative_due_days:126, requires_approval:true, tags:['brand'] }),
          task('Secure the domain and role-based email addresses', 'Use accounts the ministry can retain when volunteers or staff change.', { relative_due_days:140, tags:['communications'] }),
          task('Create a basic visual identity', 'Develop a practical logo, color, type, and usage guide that fits the audience and can scale.', { relative_due_days:161, tags:['brand'] }),
          task('Publish a simple interest page', 'Explain the vision, location, contact path, privacy expectations, and the next way to participate.', { relative_due_days:175, tags:['communications','digital'] }),
          milestone('Phase 2 foundation review', 'The pioneer, coach, and regional leader confirm that the ministry, team, financial, and administrative foundations are sound enough to enter detailed launch planning.', { relative_due_days:182, requires_approval:true, tags:['approval','milestone'] })
        ])
      ]
    },
    {
      title:'Phase 3 · Build the Launch Plan',
      description:'Turn the foundation into an integrated plan for people, ministry, operations, and public launch.',
      tasks:[
        group('Build the integrated launch strategy', 'Create one working plan that connects the mission, people, money, ministry, and timeline.', [
          task('Choose a target launch date', 'Select a date informed by readiness, community rhythms, facility realities, finances, and team capacity.', { relative_due_days:196, requires_approval:true, tags:['timeline'] }),
          task('Define measurable launch outcomes', 'Set healthy targets for team readiness, prayer, relationships, groups, finances, safeguarding, and follow-up rather than attendance alone.', { relative_due_days:203, tags:['strategy','measurement'] }),
          task('Build the critical-path timeline', 'Sequence decisions, approvals, training, purchases, communication, previews, and rehearsals leading to launch.', { relative_due_days:210, tags:['timeline','strategy'] }),
          task('Identify major risks and contingencies', 'Plan for funding gaps, facility loss, volunteer shortages, technology failure, family strain, safety incidents, and delayed launch.', { relative_due_days:217, tags:['risk','strategy'] }),
          task('Approve the integrated launch strategy', 'The pioneer, coach, and regional leader review the plan, assumptions, and decision points.', { relative_due_days:224, requires_approval:true, participant_editable:false, default_priority:1, tags:['strategy','approval'] })
        ]),
        group('Grow community relationships and the launch team', 'Build trust through listening, serving, invitation, and meaningful participation.', [
          task('Create a relationship map', 'List people, households, community organizations, churches, and leaders connected to the mission field.', { relative_due_days:196, tags:['community','relationships'] }),
          task('Set a weekly community-engagement rhythm', 'Protect recurring time for listening, hospitality, evangelism, service, and follow-up.', { relative_due_days:203, tags:['community','mission'] }),
          task('Plan initial service or outreach opportunities', 'Choose activities that respond to real community priorities and build genuine relationships.', { relative_due_days:231, tags:['community','outreach'] }),
          task('Develop the launch-team onboarding process', 'Create a clear path from interest to conversation, commitment, placement, training, and care.', { relative_due_days:238, tags:['team','onboarding'] }),
          task('Set team-growth checkpoints', 'Agree with the coach on realistic checkpoints for team size, health, diversity, leadership coverage, and participation.', { relative_due_days:245, tags:['team','measurement'] })
        ]),
        group('Prepare leaders and ministry teams', 'Ensure each essential ministry has a capable leader, clear expectations, and safe practices.', [
          task('Create the launch leadership map', 'Name essential teams, accountable leaders, decision rights, reporting lines, and remaining gaps.', { relative_due_days:224, tags:['leadership','team'] }),
          task('Write simple role descriptions', 'Clarify purpose, responsibilities, authority, time commitment, training, and who supports each role.', { relative_due_days:238, tags:['leadership'] }),
          task('Recruit and approve ministry-team leaders', 'Evaluate character, alignment, competence, availability, and required screening before placement.', { relative_due_days:266, requires_approval:true, tags:['leadership','team'] }),
          task('Train leaders in culture and safeguarding', 'Cover mission, values, disciple making, volunteer care, conflict, communication, safety, and incident response.', { relative_due_days:280, tags:['leadership','training','safety'] }),
          task('Confirm coverage and backup leaders', 'Identify gaps and backups for every ministry essential to a safe, sustainable launch.', { relative_due_days:294, tags:['leadership','readiness'] })
        ]),
        group('Prepare discipleship, groups, and guest follow-up', 'Build the ministry pathways that help people belong, grow, and move into mission.', [
          task('Design the first-step experience', 'Create a simple response for guests and interested people that includes personal follow-up and a clear next step.', { relative_due_days:231, tags:['assimilation'] }),
          task('Choose initial group and discipleship content', 'Select material that fits Open Bible convictions, the audience, leader capacity, and the disciple-making pathway.', { relative_due_days:245, tags:['discipleship','groups'] }),
          task('Recruit and train initial group leaders', 'Prepare leaders to facilitate Scripture, prayer, care, mission, multiplication, and healthy boundaries.', { relative_due_days:273, tags:['discipleship','leadership'] }),
          task('Build the contact and follow-up workflow', 'Define consent, secure data entry, response ownership, timing, handoffs, and how missed follow-up is surfaced.', { relative_due_days:287, tags:['assimilation','privacy'] }),
          task('Pilot the discipleship and follow-up process', 'Test the experience with the launch team and correct confusing or unreliable steps.', { relative_due_days:301, tags:['discipleship','testing'] })
        ]),
        group('Prepare the gathering and operational plan', 'Secure a suitable environment and prove that the gathering can operate safely and consistently.', [
          task('Define facility requirements and budget', 'Document location, accessibility, occupancy, children’s space, parking, storage, technology, setup time, and cost limits.', { relative_due_days:217, tags:['facility'] }),
          task('Evaluate facility options', 'Tour and compare realistic locations using the same criteria, including permits, insurance, restrictions, and contingency space.', { relative_due_days:245, tags:['facility'] }),
          task('Secure the facility or gathering arrangement', 'Complete required regional review, agreements, certificates, deposits, and access plans before announcing publicly.', { relative_due_days:273, requires_approval:true, tags:['facility','approval'] }),
          task('Design the gathering flow and space plan', 'Map arrival, signs, hospitality, worship, children, accessibility, prayer, response, offering, emergencies, setup, and teardown.', { relative_due_days:294, tags:['gathering','operations'] }),
          task('Create the equipment and supply plan', 'Prioritize essential items, reuse or borrow responsibly, assign ownership, and schedule purchases only when needed.', { relative_due_days:308, tags:['operations','budget'] }),
          milestone('Phase 3 plan review', 'The regional leader confirms that the integrated plan is coherent, adequately resourced, and ready for prelaunch execution.', { relative_due_days:315, requires_approval:true, tags:['approval','milestone'] })
        ])
      ]
    },
    {
      title:'Phase 4 · Prepare for Launch',
      description:'Test the plan, close readiness gaps, and prepare people and systems for a healthy public launch.',
      tasks:[
        group('Build public communication and invitation', 'Help the right people understand what is beginning, why it matters, and how to participate.', [
          task('Publish the full public website', 'Provide accurate gathering information, beliefs, leadership, children’s safety information, contact options, accessibility details, and privacy expectations.', { relative_due_days:322, tags:['communications','digital'] }),
          task('Complete local search and map listings', 'Use accurate, consistent public information and verify ownership of every listing.', { relative_due_days:336, tags:['communications','digital'] }),
          task('Create the launch communication plan', 'Coordinate personal invitations, community relationships, email, social media, partners, signage, and any paid communication within budget.', { relative_due_days:329, tags:['communications','launch'] }),
          task('Prepare invitation and follow-up messages', 'Write clear messages for interested people, launch-team invitations, reminders, first-time guests, and next steps.', { relative_due_days:343, tags:['communications','assimilation'] }),
          task('Confirm consent and communication practices', 'Use permission-based email and text practices and provide a clear way to update preferences or unsubscribe.', { relative_due_days:343, tags:['privacy','communications'] })
        ]),
        group('Test gatherings and ministry systems', 'Use previews and rehearsals to reveal gaps before public launch.', [
          task('Conduct a setup and technology rehearsal', 'Test access, load-in, power, audio, visuals, internet, signs, accessibility, teardown, and equipment storage.', { relative_due_days:329, tags:['rehearsal','operations'] }),
          task('Conduct a children’s and safeguarding rehearsal', 'Test check-in, pickup, ratios, screening, allergies, emergency communication, incident response, and secure records.', { relative_due_days:343, tags:['rehearsal','safety'] }),
          task('Hold the first preview gathering', 'Invite a limited group, run the full experience, collect observations, and practice guest follow-up.', { relative_due_days:350, tags:['preview','gathering'] }),
          task('Correct issues from the first preview', 'Assign owners and deadlines for safety, people, process, communication, facility, and technology gaps.', { relative_due_days:357, tags:['preview','improvement'] }),
          task('Hold a final preview or full rehearsal', 'Demonstrate that essential teams and systems can operate without depending on last-minute heroics.', { relative_due_days:378, tags:['preview','readiness'] })
        ]),
        group('Confirm financial and operational readiness', 'Verify that launch commitments can be met without compromising accountability or care.', [
          task('Update the launch and first-year budgets', 'Replace estimates with current commitments, actual costs, reserves, and conservative income assumptions.', { relative_due_days:336, tags:['finance'] }),
          task('Confirm cash, commitments, and spending controls', 'Identify restricted funds, remaining gaps, purchase authority, reimbursement, reporting, and contingency limits.', { relative_due_days:350, requires_approval:true, tags:['finance','governance'] }),
          task('Verify insurance, agreements, and required approvals', 'Confirm that current activities, facility, staff, volunteers, vehicles, and events are covered as applicable.', { relative_due_days:364, requires_approval:true, participant_editable:false, tags:['risk','approval'] }),
          task('Test giving, receipting, and financial reporting', 'Process test transactions and verify secure handling, donor records, acknowledgments, deposits, reconciliation, and reporting.', { relative_due_days:371, tags:['finance','testing'] }),
          task('Finalize launch-day contacts and incident response', 'Give leaders one current list for facility, safety, medical, child protection, technology, communications, and regional escalation.', { relative_due_days:385, tags:['risk','operations'] })
        ]),
        group('Care for and prepare the team', 'Build clarity, confidence, spiritual health, and sustainable expectations before launch.', [
          task('Confirm every launch-day role and backup', 'Make sure each person knows arrival time, leader, responsibilities, handoffs, and what to do when something changes.', { relative_due_days:371, tags:['team','readiness'] }),
          task('Review team health and unresolved conflict', 'Address relational strain, unclear authority, overload, and safety concerns before public pressure increases.', { relative_due_days:378, tags:['team','health'] }),
          task('Plan pioneer and family rest around launch', 'Protect sleep, Sabbath, family time, counseling or pastoral support, and a realistic post-launch recovery rhythm.', { relative_due_days:385, tags:['health','family'] }),
          task('Hold a team prayer and commissioning gathering', 'Pray for the community, send the team in unity, restate the mission, and clarify final communication.', { relative_due_days:399, tags:['prayer','team'] }),
          milestone('Go or pause readiness decision', 'The pioneer, coach, and regional leader use agreed readiness criteria to approve launch, delay it, or narrow the plan.', { relative_due_days:392, requires_approval:true, participant_editable:false, default_priority:1, tags:['approval','milestone'] })
        ])
      ]
    },
    {
      title:'Phase 5 · Launch and Stabilize',
      description:'Launch, learn quickly, care for people, and establish healthy rhythms during the first months.',
      tasks:[
        group('Launch the church', 'Carry out the launch plan while protecting people, mission, and safety.', [
          milestone('Hold the public launch gathering', 'Welcome the community, clearly communicate the gospel and next steps, and execute the approved gathering and safety plans.', { relative_due_days:420, tags:['launch','milestone'] }),
          task('Complete first guest follow-up', 'Respond personally within the promised timeframe, record consent and next steps, and alert leaders to any pastoral or safety concerns.', { relative_due_days:422, default_priority:1, tags:['assimilation'] }),
          task('Debrief with team leaders', 'Celebrate, identify facts rather than blame, and assign only the most important corrections for the next gathering.', { relative_due_days:423, tags:['team','improvement'] }),
          task('Update attendance, connection, and financial records', 'Reconcile accurate ministry information while limiting access to people who need it.', { relative_due_days:424, tags:['administration','privacy'] }),
          task('Thank volunteers, partners, and prayer supporters', 'Communicate gratitude, early learning, prayer needs, and the next meaningful update.', { relative_due_days:427, tags:['relationships','communications'] })
        ]),
        group('Establish the first six-week rhythm', 'Move from launch intensity to repeatable ministry and leadership practices.', [
          task('Review a weekly ministry scorecard', 'Track a small set of useful measures for discipleship, people, groups, teams, finances, follow-up, safety, and leader health.', { relative_due_days:434, tags:['measurement'] }),
          task('Meet weekly with key leaders', 'Review people, mission, problems, decisions, prayer, workload, and the next seven days.', { relative_due_days:434, tags:['leadership'] }),
          task('Continue frequent coaching', 'Use coaching to interpret patterns, protect health, and avoid reacting to a single strong or weak week.', { relative_due_days:441, tags:['coaching'] }),
          task('Move interested people into groups and next steps', 'Make participation personal and clear instead of relying only on public gatherings.', { relative_due_days:448, tags:['discipleship','assimilation'] }),
          task('Resolve recurring operational problems', 'Fix root causes in setup, technology, children, follow-up, facility, volunteer care, and communication.', { relative_due_days:455, tags:['operations','improvement'] })
        ]),
        group('Protect ministry health', 'Pay attention to the spiritual, relational, financial, and organizational health beneath visible activity.', [
          task('Review pioneer and family health', 'Discuss rest, emotional load, marriage or household strain, finances, boundaries, and support with trusted leaders.', { relative_due_days:448, tags:['health','family'] }),
          task('Review team health and volunteer load', 'Notice overuse, unclear expectations, unresolved conflict, unsafe practices, and people serving outside their capacity.', { relative_due_days:462, tags:['team','health'] }),
          task('Review financial position and controls', 'Compare actual results with budget, reconcile accounts, report to oversight, and adjust spending early.', { relative_due_days:462, requires_approval:true, tags:['finance','governance'] }),
          task('Review safeguarding and incident records', 'Confirm follow-up, documentation, confidentiality, policy compliance, and any changes needed.', { relative_due_days:476, requires_approval:true, participant_editable:false, tags:['safety','governance'] }),
          task('Schedule a recovery and planning day', 'Step out of weekly production to pray, rest, review learning, and make measured adjustments.', { relative_due_days:483, tags:['health','planning'] })
        ]),
        group('Complete the 90-day review', 'Evaluate the launch season and agree on the next stage of development.', [
          task('Gather feedback from guests, team members, and community partners', 'Listen for patterns in belonging, clarity, safety, leadership, and community credibility.', { relative_due_days:490, tags:['feedback'] }),
          task('Compare outcomes with the launch plan', 'Review the agreed indicators and explain significant differences without manipulating the story.', { relative_due_days:497, tags:['measurement','review'] }),
          task('Update the ministry and financial plan', 'Revise priorities, budget, team structure, groups, communication, and gathering systems using actual learning.', { relative_due_days:504, tags:['planning'] }),
          task('Identify the next leadership and disciple-making priorities', 'Choose a focused set of actions that strengthen people and mission rather than adding programs indiscriminately.', { relative_due_days:504, tags:['leadership','discipleship'] }),
          milestone('90-day regional review', 'The pioneer and regional leader review health, accountability, sustainability, and the next six months.', { relative_due_days:510, requires_approval:true, participant_editable:false, tags:['approval','milestone'] })
        ])
      ]
    },
    {
      title:'Phase 6 · Strengthen and Multiply',
      description:'Develop sustainable leadership, discipleship, finances, and multiplication beyond the initial launch.',
      tasks:[
        group('Strengthen discipleship and belonging', 'Improve the pathways that help people follow Jesus, form relationships, and participate in mission.', [
          task('Review the disciple-making pathway', 'Identify where people are engaging, stalling, or falling through gaps and make the next improvement.', { relative_due_days:540, tags:['discipleship'] }),
          task('Strengthen groups and pastoral care', 'Confirm leader support, care escalation, healthy boundaries, multiplication expectations, and access for new people.', { relative_due_days:570, tags:['groups','care'] }),
          task('Build a baptism and membership or belonging process', 'Follow Open Bible and local church requirements while keeping the process biblical, understandable, and relational.', { relative_due_days:600, requires_approval:true, tags:['discipleship','open-bible'] }),
          task('Create a regular newcomer pathway', 'Offer a dependable next step that explains the gospel, church, leadership, expectations, and ways to participate.', { relative_due_days:600, tags:['assimilation'] }),
          task('Review community presence and partnerships', 'Evaluate whether the church is listening, serving, sharing the gospel, and keeping its commitments in the community.', { relative_due_days:630, tags:['community','mission'] })
        ]),
        group('Develop leaders and teams', 'Move from filling roles to forming leaders who can equip others.', [
          task('Create a leadership development pathway', 'Define how people are identified, formed, assessed, entrusted, coached, and released into ministry.', { relative_due_days:555, tags:['leadership'] }),
          task('Identify emerging leaders', 'Look for character, faithfulness, gifting, relationships, teachability, and missional fruit rather than visibility alone.', { relative_due_days:585, tags:['leadership'] }),
          task('Give emerging leaders real responsibility', 'Provide supervised opportunities, clear authority, feedback, and room to learn.', { relative_due_days:615, tags:['leadership','development'] }),
          task('Develop backup and succession coverage', 'Reduce unhealthy dependence on the pioneer by preparing others for essential leadership and operational roles.', { relative_due_days:645, tags:['leadership','sustainability'] }),
          task('Review staff and volunteer policies', 'Update expectations, screening, care, compensation, conflict, discipline, and documentation as the organization grows.', { relative_due_days:660, requires_approval:true, tags:['policy','leadership'] })
        ]),
        group('Build sustainable stewardship and governance', 'Strengthen accountability, generosity, planning, and organizational resilience.', [
          task('Build the next annual ministry budget', 'Connect spending to mission, use realistic income, maintain reserves, and identify decisions required if income changes.', { relative_due_days:600, tags:['finance'] }),
          task('Develop congregational stewardship practices', 'Teach biblical generosity and provide transparent, secure, and accessible ways to give.', { relative_due_days:630, tags:['finance','discipleship'] }),
          task('Review governance with regional leadership', 'Confirm board or council development, bylaws, reporting, decision rights, conflicts of interest, and denominational requirements.', { relative_due_days:660, requires_approval:true, participant_editable:false, tags:['governance','open-bible'] }),
          task('Complete an annual risk and insurance review', 'Update coverage, safety practices, facilities, staff, vehicles, cyber risks, contracts, and incident learning.', { relative_due_days:690, requires_approval:true, tags:['risk','insurance'] }),
          task('Create a three-year sustainability outlook', 'Assess people, leadership, facilities, finances, systems, community trust, and scenarios for healthy growth or contraction.', { relative_due_days:705, tags:['strategy','sustainability'] })
        ]),
        group('Establish a culture of multiplication', 'Help multiplication become a practiced conviction rather than a future slogan.', [
          task('Name the church’s multiplication convictions', 'Clarify how making disciples, developing leaders, sending people, and planting churches shape present decisions.', { relative_due_days:570, tags:['multiplication'] }),
          task('Identify potential pioneers and sending opportunities', 'Notice leaders and communities where new disciple-making work may be emerging.', { relative_due_days:630, tags:['multiplication','leadership'] }),
          task('Set aside resources for multiplication', 'Begin an appropriate rhythm of prayer, leadership time, people, coaching, and financial investment.', { relative_due_days:660, requires_approval:true, tags:['multiplication','finance'] }),
          task('Give leaders cross-cultural or pioneering experience', 'Create supervised opportunities to start new groups, ministries, locations, or community initiatives.', { relative_due_days:690, tags:['multiplication','development'] }),
          milestone('One-year health and multiplication review', 'The church and regional leader celebrate, assess health and accountability, and agree on priorities for the next year.', { relative_due_days:720, requires_approval:true, participant_editable:false, tags:['approval','milestone','multiplication'] })
        ])
      ]
    }
  ]
};
