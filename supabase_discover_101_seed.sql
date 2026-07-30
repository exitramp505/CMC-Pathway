-- Discover 101 native CMC Pathway course
-- Requires supabase_course_content_schema.sql.

do $cmc_seed$
declare
  course_uuid uuid;
  start_module_uuid uuid;
  biblical_module_uuid uuid;
begin
  insert into public.cmc_courses (
    slug,
    title,
    subtitle,
    description,
    status,
    stage_key,
    access_mode,
    navigation_mode,
    estimated_minutes,
    updated_at,
    published_at
  )
  values (
    'discover',
    'Discover: Church Multiplication 101',
    'A biblical introduction to church multiplication',
    'A short online course that introduces the biblical foundation for church multiplication and helps pioneers, pastors, and sending churches identify a practical next step.',
    'published',
    'discover',
    'automatic',
    'guided',
    57,
    now(),
    now()
  )
  on conflict (slug) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    status = 'published',
    stage_key = 'discover',
    access_mode = 'automatic',
    navigation_mode = 'guided',
    estimated_minutes = excluded.estimated_minutes,
    updated_at = now(),
    published_at = coalesce(public.cmc_courses.published_at, now())
  returning id into course_uuid;

  delete from public.cmc_course_modules where course_id = course_uuid;

  insert into public.cmc_course_modules (course_id, title, description, position, updated_at)
  values (course_uuid, 'Start Here', 'Begin with the purpose, outcomes, and shared expectations for Discover.', 0, now())
  returning id into start_module_uuid;

  insert into public.cmc_course_modules (course_id, title, description, position, updated_at)
  values (course_uuid, 'Biblical Mandate', 'Explore the biblical case for multiplication, the fivefold call, ministry calling, and the apostolic pattern.', 1, now())
  returning id into biblical_module_uuid;

  insert into public.cmc_course_lessons (
    course_id,
    module_id,
    title,
    summary,
    content,
    lesson_type,
    video_url,
    image_url,
    image_alt,
    resource_url,
    resource_label,
    reflection_prompt,
    response_required,
    estimated_minutes,
    is_required,
    position,
    updated_at
  )
  values
  (
    course_uuid,
    start_module_uuid,
    'Welcome to Discover',
    'Understand what this short course covers and how it fits into your CMC Pathway.',
    '## Start with Discover

Discover is a short online course for pioneers, pastors, and church leaders who want to understand church multiplication and their place in it.

You will explore the biblical mandate for multiplication, examine Open Bible’s vision, and consider your calling and context. The course also introduces the ISA Profiler to help you recognize strengths and areas for growth.

## By the end of the course, you will be able to:

- Explain the biblical foundation for church multiplication.

- Describe Open Bible’s vision to make disciples, develop leaders, and multiply churches.

- Identify how your calling may connect with pioneering, sending, or supporting multiplication.

- Choose a practical next step for continued discernment and development.

You do not need a finished plan to begin. Discover gives you the shared language and foundation needed to take the next step with clarity.',
    'article',
    '',
    '',
    '',
    '',
    '',
    '',
    false,
    5,
    true,
    0,
    now()
  ),
  (
    course_uuid,
    biblical_module_uuid,
    'Why Multiplication Matters',
    'See why multiplication is the normal New Testament expression of obedience to Jesus.',
    '## Welcome

Welcome to this journey into church multiplication. Before we dive into the Scriptures, it is important to pause and remember why multiplication matters. Multiplication is not a trend or a strategy we invented; it is the way the gospel has always spread. From the first disciples in Jerusalem to the churches that grew across the Roman Empire, followers of Jesus have carried the good news forward, forming new communities of faith wherever they went. As you begin this section, keep in mind that multiplication is not about numbers; it is about lives transformed, leaders raised up, and new places where the Kingdom of God takes root.

## The Biblical Case for Multiplication

The New Testament makes it clear that multiplication is at the heart of God’s mission.

- Jesus’ Commission: “Go and make disciples of all nations” (Matthew 28:19). Jesus commanded His followers to reproduce themselves by making disciples who make more disciples.

- Spirit-Empowered Witness: “You will be my witnesses in Jerusalem, and in all Judea and Samaria, and to the ends of the earth” (Acts 1:8). The mission is ever-expanding, reaching new places and people through the Spirit’s power.

- The Church Scattered: “Those who had been scattered preached the word wherever they went” (Acts 8:4). Ordinary believers carried the gospel into new regions, sparking the first wave of church multiplication.

- Antioch as a Sending Church: In Acts 13:2–3, the Spirit directed the church in Antioch to send out Paul and Barnabas. This became a pattern of multiplying leaders and communities into new frontiers.

- Paul’s Ambition: Paul wrote, “It has always been my ambition to preach the gospel where Christ was not known, so that I would not be building on someone else’s foundation” (Romans 15:20). His life was committed to seeing the Kingdom established where it wasn’t.

- Churches Planting Churches: Communities like Philippi, Corinth, and Ephesus became centers of multiplication, sending out leaders, resources, and support to establish more churches.

Key Insight: The New Testament shows multiplication as the normal expression of obedience to Jesus and the Spirit. Disciples reproduce disciples. Leaders reproduce leaders. Churches reproduce churches. The gospel moves forward through multiplying communities of faith.

Think of a place, people, community, city, or demographic that God is highlighting to you. It could be as close as your workplace or as far as another continent.',
    'video',
    '',
    '',
    '',
    '',
    '',
    'Where is the Kingdom not yet established in your world?',
    true,
    10,
    true,
    0,
    now()
  ),
  (
    course_uuid,
    biblical_module_uuid,
    'The Fivefold Call',
    'Explore how the fivefold gifts equip a healthy church to move outward in mission.',
    '## God’s Blueprint for a Multiplying Church

The goal of this section is to help you see multiplication as God’s design for His church. Understanding the Fivefold gifts in Ephesians 4:11–12 is key to that design. When Christians and churches only rely on pastoral and teaching gifts, they can become focused on maintaining what already exists. But when the equipping of apostles, prophets, evangelists, pastors, and teachers is all active, the church becomes balanced and multiplying. The apostolic call, to establish the Kingdom where it is not yet, is not reserved for a few. It should be woven into the identity of every believer and every church. Learning how these gifts work together shows us how God intended His people to live on mission and ensure that multiplication is always part of the church’s DNA.

“So Christ himself gave the apostles, the prophets, the evangelists, the pastors and teachers, to equip his people for works of service, so that the body of Christ may be built up.”

Ephesians 4:11–12

## Why the Fivefold Is Important

Churches are living ecosystems, not businesses or machines. Every ecosystem needs balance. If one part is missing, the whole system suffers.

- Without Apostles the church loses vision and stops advancing into new territory.

- Without Prophets the church loses alignment with God’s voice and easily compromises.

- Without Evangelists the church forgets the lost and turns inward.

- Without Pastors the church burns people out instead of caring for them.

- Without Teachers the church drifts into immaturity and false doctrine.

When only pastors and teachers are emphasized, churches become focused on gathering and maintaining. The apostolic, prophetic, and evangelistic functions pull the church outward into mission and multiplication.

The fivefold is Christ’s strategy for building a body that is both healthy and multiplying. It ensures that the whole church is equipped, not just entertained or cared for.

## What Do We Mean by “Apostolic”?

The word apostolic can mean different things across the body of Christ. For some, it refers to a denomination or tradition like the Apostolic Church. Others use it for an office or position, calling someone an “apostle.” Still others connect it to apostolic succession, the passing down of authority from the original apostles through church history.

In this course, we’re using the word apostolic in a specific way:

Apostolic means establishing the Kingdom where it currently isn’t.

In this course, the word apostolic refers to the pioneering call Jesus gave His followers to go, to cross boundaries, and to form new communities of faith in places where the gospel has not yet taken root.

“My ambition has always been to preach the Good News where the name of Christ has never been heard, rather than where a church has already been started by someone else.”

‭‭Romans‬ ‭15‬:‭20‬ ‭NLT

## Why Everyone Is Called to the Apostolic work

The word apostle means sent one. Jesus said in John 20:21, “As the Father has sent me, I am sending you.”

This means that apostolic work is not just for a few “special” leaders. It’s the calling of every believer and every church. Here’s how that plays out for believers and churches:

Every Believer Functions Apostolically

- When you share your faith with a co-worker, you’re taking the gospel where it isn’t yet established.

- When you start a Bible study in your neighborhood, you’re planting seeds of new spiritual community.

- When you initiate a new circle of people exploring faith together, you are breaking new apostolic ground and planting the seeds of Kingdom community.

Every Church Functions Apostolically

- A church is not fully mature until it reproduces. Just as a living organism naturally reproduces, so too must churches.

- Churches that function apostolically don’t measure success only by attendance but by sending capacity.

- Multiplying churches see themselves as bases for mission, not just destinations for worship.

## The Apostolic Thread in the Fivefold

Even though the five gifts have unique functions, they all participate in the apostolic mission of establishing the Kingdom where it isn’t:

- Apostles pioneer new works.

- Prophets hear God and call the church to faithfulness as it advances.

- Evangelists gather new believers into the movement.

- Pastors care for those being added and create healthy community.

- Teachers ground new disciples in truth so the mission reproduces faithfully.

Key Point: The apostolic call gives direction to all the gifts, moving the church outward into new places, forward into fresh opportunities, and multiplying new communities of faith.

## Why This Matters for Multiplication

- Without the apostolic impulse, churches settle into maintenance and eventually decline.

- With the apostolic impulse, even a small circle of believers can ignite movements that spread far beyond their starting point.

- The apostolic call keeps us aligned with Jesus’ final command, “Go and make disciples.”

The earliest believers never questioned whether they should multiply. They were compelled by the Spirit and the command of Jesus to go and naturally reproduced disciples and communities of faith. Multiplication was the normal expression of obedience to Jesus.

When the church loses that impulse, it drifts into survival mode, measuring success by attendance or programs rather than sending and reproducing. But when the apostolic call is alive, the church looks outward, crosses boundaries, and pushes into new territory. This is what keeps the church vibrant, resilient, and fruitful in every generation.

Multiplication is not just a growth strategy. It is the original design of the church, a reflection of the life of Christ Himself multiplying through His body on earth.',
    'article',
    '',
    '',
    '',
    '',
    '',
    'Which of the Fivefold gifts feels most natural to you, and which feels like an area where God may want to stretch you?',
    true,
    15,
    true,
    1,
    now()
  ),
  (
    course_uuid,
    biblical_module_uuid,
    'The Call to Ministry',
    'Understand the general call of every believer and the specific call to pioneering ministry.',
    '## Called Into the Missio Dei

In every generation God invites His people to share in His missio Dei, the sending activity of God in the world. Each believer is drawn into the general call to follow Jesus and make disciples, and some are also set apart for pioneering new works that carry the gospel into new places and form new communities. In this section we will explore how God calls, how that call is recognized and affirmed, and how Open Bible provides discernment and credentialing to equip leaders for multiplication.

## The General Call

Every follower of Jesus is called into ministry. Jesus’ command in Matthew 28:19 is not limited to a select few: “Go and make disciples of all nations.”

This flows from the doctrine of the sainthood of all believers, the truth that all Christians are set apart, Spirit-filled, and entrusted with God’s mission. Ministry is not reserved only for clergy or professionals. Every believer is called to represent Christ, carry His presence into the world, and multiply disciples.

## The Specific Call

While every disciple is called to make disciples, some are uniquely set apart for pioneering works, and every leader is called to raise up new leaders who God may use as future pioneers.

Acts 13:1–4 gives us a clear example. While the church in Antioch was worshiping and fasting, the Holy Spirit said, “Set apart for me Barnabas and Saul for the work to which I have called them.”

The call for them was not about personal ambition; it was Spirit-directed and confirmed through the church community. Specific calls often lead to new works, new churches, or new movements of disciples.

## The Marks of a Call

How do we recognize a call to ministry, especially to pioneering or apostolic work? Three marks often appear together:

- Burden: a Spirit-given desire or holy discontent to see something change or begin.

- Confirmation: affirmation from spiritual leaders and the wider body of Christ.

- Fruit: evidence of God working through your life, such as people coming to faith, leadership influence, or a pattern of disciple-making.

For some, that burden may be to start new churches in unreached places. For others, it may be to reproduce leaders and multiply outward from the existing church.

## Example: Paul and Barnabas

The call of Paul and Barnabas in Acts 13 is a model for us:

- Spirit-led: The Holy Spirit initiated the call.

- Community-confirmed: Leaders in Antioch laid hands on them and sent them out.

- Mission-focused: Their call was outward-facing, aimed at taking the gospel where it had not yet been proclaimed.

This shows us that a call to ministry is not a private feeling alone. It is discerned through prayer, confirmed by others, and proven in action.

## Discernment and Credentialing with Open Bible

In Open Bible, we believe that calling must be nurtured, tested, and affirmed. Two pathways help in this process:

- Credentialing: For those stepping into ministry leadership, credentialing provides recognition, accountability, and belonging within the Open Bible family. Credentials affirm your calling and connect you to the larger body, offering resources, support, and covering as you pursue ministry.

- Learn more about credentialing here https://www.openbible.org/connect/credentials

- The Discernment Center: A prayerful and practical environment designed to help ministry pioneers and planters gain a 360-degree view of their calling, gifting, and readiness. Over the course of a two and a half day experience, couples and teams walk through interviews, assessments, and group interactions that reveal strengths, challenges, and areas for growth. A team of leaders walk alongside participants throughout the process to listen, encourage, and provide honest feedback.

- If you would like to learn more about the Discernment Center and how it could serve you, you can connect with your Regional Director of Multiplication, who will walk with you in the process and answer your questions.

- Lead Pastors: If you are raising up pioneers, we recommend sending them to the Discernment Center and joining them in the journey as a coach leader. Your presence affirms their call, strengthens their confidence, and helps establish the kind of sending relationship that multiplication depends on.

Discernment happens best in community. Calling is clarified when the Spirit speaks, when the church affirms, and when practical pathways prepare leaders for multiplication.

## Key Insight

The sainthood of all believers tells us that ministry belongs to the whole body of Christ. Every believer is called to make disciples, and some are specifically called to pioneer. Recognizing the marks of a call, and walking through discernment and credentialing, helps us step into God’s mission with confidence, clarity, and humility.',
    'article',
    '',
    '',
    '',
    'https://www.openbible.org/connect/credentials',
    'Learn about Open Bible credentialing',
    'Share a time when you sensed God nudging you toward something new, risky, or uncomfortable. How did you respond?',
    true,
    12,
    true,
    2,
    now()
  ),
  (
    course_uuid,
    biblical_module_uuid,
    'Apostolic Work Then and Now',
    'Trace the Spirit-driven cycle that sends leaders, makes disciples, forms communities, and establishes churches.',
    '## The Cycle of Apostolic Ministry

Apostolic ministry has always moved in a Spirit-driven cycle. It begins when people are sent, continues as disciples are made and gathered, grows into established churches, and then sends out more missionaries to repeat the process. This cycle is as true today as it was in the book of Acts.

- Missionaries Sent: The cycle begins when pioneers are sent into new places. In Acts 13, the church in Antioch prayed and sent Paul and Barnabas to carry the gospel to unreached regions. Today, churches raise up and release leaders into neighborhoods, cities, and nations.

- Disciples Made: As missionaries go, the gospel is proclaimed, and new disciples are made. In Acts 8, scattered believers preached wherever they went, and people came to faith in Samaria. Today, discipleship happens in living rooms, workplaces, cafés, and schools.

- Community Formed: Disciples do not stay isolated. They gather and form new communities of faith. In Acts 16, Lydia’s household became a spiritual family and the beginning of the church in Philippi. Today, these communities can look like small groups, house churches, or gatherings in public spaces.

- Church Established: As communities grow, they develop leadership, worship, teaching, and mission, becoming established churches. In Acts 19, Paul’s ministry in Ephesus led to a strong regional church that influenced an entire area. Today, multiplying churches serve as bases for training and sending.

The cycle continues as each established church raises up new leaders and sends them out. Apostolic ministry is never static — it keeps pressing the gospel into new places, forming new communities, and sending again.

## The Apostolic Pattern in Acts

The New Testament gives us vivid examples of how apostolic ministry expanded the Kingdom:

- Antioch as a Sending Hub (Acts 13:1–3): The Spirit directed the leaders in Antioch to set apart Paul and Barnabas. This moment established a sending pattern that shaped the early church. Antioch didn’t just gather believers; it multiplied leaders and launched new communities.

- Scattered Believers (Acts 8:1–4): When persecution broke out in Jerusalem, ordinary believers carried the gospel wherever they went. They didn’t wait for apostles to arrive — they lived as sent ones. This scattering spread the gospel into Samaria and beyond.

- Lydia’s Household (Acts 16:11–15, 40): In Philippi, the gospel took root in Lydia’s home. Her household became the foundation for the first church in Europe. Apostolic work often began with households and communities that grew into multiplying centers.

- Regional Hubs (Acts 19:8–10): Paul ministered in Ephesus for two years, and from that city the gospel spread throughout the region of Asia. Ephesus became a powerhouse hub for training and sending.

Key Insight: In Acts, apostolic ministry was not limited to a position or office. It was the Spirit-driven expansion of the gospel into new places through both leaders and everyday believers.

## Apostolic Expressions Today

The same Spirit is at work now, sending people to multiply disciples and form new communities of faith. As disciples are made and gathered, churches are established and the cycle continues. Apostolic ministry today takes many forms:

- Disciples Multiplying in Every Context: From suburban neighborhoods to urban centers to rural towns, believers are making disciples and forming spiritual families that reflect their local context.

- Communities Gathering in Everyday Spaces: Small, relational groups are forming in homes, cafés, schools, and workplaces. These gatherings often grow into house churches or micro-church networks that multiply quickly.

- Churches Emerging from Multiplication: As disciples and communities mature, they develop into established churches with worship, leadership, and mission. Some churches become multi-community congregations, hosting diverse groups — ethnic communities, age groups, or worship styles — while sharing resources and vision.

- Movements Spreading Globally: Around the world, simple, reproducible disciple-making patterns are multiplying rapidly. These global disciple-making movements show the same cycle we see in Acts: disciples made, communities formed, churches established, and missionaries sent again.

Key Truth: Apostolic ministry today follows the same Spirit-driven pattern as the early church. It starts with disciples being made and leads naturally to communities and churches being formed, which in turn send new pioneers to continue the cycle.

## Then and Now: The Parallels

Scattered Believers → Everyday Missionaries

The believers scattered from Jerusalem remind us that multiplication is not only the work of professional leaders. Today, every follower of Jesus is sent into their neighborhood, workplace, and networks.

Antioch → Sending Churches Today

Just as Antioch sent Paul and Barnabas, healthy churches today see themselves as bases for sending out missionaries, leaders and planters.

Lydia’s Household → New Communities in Homes and Networks

What began in Lydia’s home mirrors today’s house churches, micro-churches, and local groups that become centers of faith and mission.

Ephesus → Regional Hubs

Ephesus trained and multiplied leaders for an entire region. Today, churches and networks serve as hubs that equip and release pioneers for local, national, and global mission.

## Why This Matters for Us

- Apostolic work keeps the church from becoming stagnant and inward-focused.

- Every generation needs pioneers who will push the gospel into new places.

- Every believer and every church has a role in this — some will go, others will send, and all are called to multiply disciples.',
    'article',
    '',
    '/assets/discover-apostolic-cycle.svg',
    'A circular pathway showing missionaries sent, disciples made, community formed, and church established before the cycle repeats.',
    '',
    '',
    'What part of the apostolic pattern (sending, scattering, household faith, regional hubs) do you feel most connected to?',
    true,
    15,
    true,
    3,
    now()
  );

  update public.cmc_course_enrollments
  set progress = 0,
      completed_at = null,
      last_opened_at = now()
  where course_id = course_uuid;

  update public.candidate_assignments
  set item_type = 'course',
      stage_key = 'discover',
      status = 'assigned',
      progress = 0,
      external_status = '',
      invitation_status = '',
      assignment_source = 'automatic',
      completed_at = null,
      hidden_at = null,
      updated_at = now()
  where item_key = 'discover_course';

  insert into public.candidate_assignments (
    user_id,
    candidate_email,
    candidate_name,
    item_key,
    item_type,
    stage_key,
    status,
    progress,
    external_status,
    invitation_status,
    assignment_source,
    assigned_at,
    hidden_at,
    updated_at
  )
  select
    profile.id,
    profile.email,
    coalesce(nullif(profile.full_name, ''), profile.email, 'Participant'),
    'discover_course',
    'course',
    'discover',
    'assigned',
    0,
    '',
    '',
    'automatic',
    now(),
    null,
    now()
  from public.candidate_profiles profile
  where profile.account_role = 'participant'
  on conflict (user_id, item_key) do update set
    item_type = excluded.item_type,
    stage_key = excluded.stage_key,
    status = excluded.status,
    assignment_source = excluded.assignment_source,
    hidden_at = null,
    updated_at = now();
end
$cmc_seed$;
