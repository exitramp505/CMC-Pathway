-- Discover: Church Multiplication 101 native CMC Pathway course
-- Locked package 2026-09-02. Updates the existing course with slug `discover` on conflict.
-- Requires supabase_course_content_schema.sql.
-- Live apply still requires running this seed in the Supabase SQL Editor or saving
-- the same structure in course-builder.html as cmc_admin. This file does not deploy itself.
--
-- 13 video placeholders totaling 45 minutes 30 seconds. Videos and graphics are not produced.
-- Section 4 is the native Pathway Ministry Readiness Inventory (ministry-readiness.html, assignment key ministry_readiness).
-- Do not send learners off-site. Do not charge a fee. Do not ask for an outside account.
-- Policy gaps (whether this course step can assign ministry_readiness, whether senders take it, whether completion is required;
-- credentialing fees not on the live page; Discernment Center URL/dates/cost) are left as host notes. Do not invent that policy.

do $cmc_seed$
declare
  course_uuid uuid;
  discover_module_uuid uuid;
  calling_module_uuid uuid;
  vision_module_uuid uuid;
  mri_module_uuid uuid;
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
    'Biblical foundations of multiplication for pioneers and sending pastors',
    $course_desc$George Williams, Director of Multiplication for Open Bible East and CMC team lead, walks pioneers, planters, and sending pastors through the biblical foundations of multiplication. Disciples make disciples. Leaders develop leaders. Churches reproduce churches.$course_desc$,
    'published',
    'discover',
    'automatic',
    'guided',
    270,
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
  values (course_uuid, $discover_module_title$Discover$discover_module_title$, $discover_module_desc$Start with why Jesus sends His people. See how He equips the whole church. Name the apostolic work. Watch the cycle. Recognize it in our day. Find your place. Take a next step.$discover_module_desc$, 0, now())
  returning id into discover_module_uuid;

  insert into public.cmc_course_modules (course_id, title, description, position, updated_at)
  values (course_uuid, $calling_module_title$Calling Alignment$calling_module_title$, $calling_module_desc$Calling has names, streets, relationships, and a way of making disciples that could actually work among those people.$calling_module_desc$, 1, now())
  returning id into calling_module_uuid;

  insert into public.cmc_course_modules (course_id, title, description, position, updated_at)
  values (course_uuid, $vision_module_title$Open Bible Churches Vision$vision_module_title$, $vision_module_desc$Official mission and vision from Who We Are: globally make disciples, develop leaders, and multiply churches.$vision_module_desc$, 2, now())
  returning id into vision_module_uuid;

  insert into public.cmc_course_modules (course_id, title, description, position, updated_at)
  values (course_uuid, $mri_module_title$Ministry Readiness Inventory$mri_module_title$, $mri_module_desc$Take the native CMC Pathway Ministry Readiness Inventory (ministry-readiness.html, assignment key ministry_readiness). No outside account. No fee.$mri_module_desc$, 3, now())
  returning id into mri_module_uuid;

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
    discover_module_uuid,
    $res_title$Course Resources$res_title$,
    $res_sum$Welcome to Discover: Church Multiplication 101. Recommended reading named once, plus the recurring Kingdom question.$res_sum$,
    $res_body$Welcome to Discover: Church Multiplication 101.

This Course Resources note sits at the start of the course. George Williams, Director of Multiplication for Open Bible East and CMC team lead, walks a pioneer or a sending pastor through the biblical foundations of multiplication.

Recommended reading, named once for the whole course: *Church Plantology* by Peyton Jones. The course uses the idea that multiplication is the original design of the church. Disciples make disciples. Leaders develop leaders. Churches reproduce churches. Later lessons keep those ideas without naming the book again.

Keep this question close as you move through every section: Where is the Kingdom not yet established in your world?
$res_body$,
    'article',
    '',
    '',
    '',
    '',
    '',
    $res_ref$1. Where is the Kingdom not yet established in your world?$res_ref$,
    true,
    5,
    true,
    0,
    now()
  ),
  (
    course_uuid,
    discover_module_uuid,
    $s1v1_title$Why We Multiply$s1v1_title$,
    $s1v1_sum$New Testament case for multiplication. DNA of disciples, leaders, and churches.$s1v1_sum$,
    $s1v1_body$> Video placeholder: S1-V1 Why We Multiply (4:30). Not yet produced.

> Graphic placeholder: DNA graphic. Disciples. Leaders. Churches. Caption: Multiplication is the original design of the church.

Welcome to Discover: Church Multiplication 101. I am George Williams. I serve Open Bible East as Director of Multiplication, and I lead our Church Multiplication Collective team. I am glad you are here.

If you are sensing a call to pioneer, I want to walk you through the biblical foundations before anyone talks models or launch dates. If you lead a church, I want you in this same conversation. In the New Testament, multiplication always involved a sending people. Your question is as important as the pioneer's: Who is God raising up in your church that you may need to release?

Before we open the Scriptures, pause with me on why this matters. From the first disciples in Jerusalem to the churches that grew across the Roman Empire, followers of Jesus carried the good news forward and formed new communities of faith wherever they went. Multiplication is how the gospel has always spread. Keep in view lives transformed, leaders raised up, and new places where the Kingdom of God takes root.

Look at the DNA graphic. Disciples. Leaders. Churches. Multiplication is the original design of the church. Disciples make disciples. Leaders develop leaders. Churches reproduce churches. That design is older than any of our buildings, brands, or strategies. Jesus built it into the people He sent.

### Jesus sends, and the church goes

Matthew 28:19 is where this course begins, because that is where the risen Jesus sent His people: "Go and make disciples of all nations." He commanded His followers to reproduce themselves. Disciples who make more disciples. The assignment is larger than gathering a crowd on a Sunday. The assignment is people who learn to obey Jesus and then help others do the same.

Acts 1:8 gives the reach of that sending: "You will be my witnesses in Jerusalem, and in all Judea and Samaria, and to the ends of the earth." The mission keeps expanding. New places. New people. The Spirit's power. Jerusalem matters. So does the next town. So does the people group that has never heard. The church that stays only where it already is has stopped listening to this verse.

Then the book of Acts shows ordinary obedience. Acts 8:4: "Those who had been scattered preached the word wherever they went." Persecution pushed believers out of Jerusalem, and everyday men and women carried the gospel with them. Philip, who had been serving tables in the church, preached in Samaria, and a new community of faith took shape. The work did not wait for a professional class to arrive. Sent people opened their mouths.

Acts 13:2-3 shows what happens when a church learns to send. In Antioch the Spirit said, "Set apart for me Barnabas and Saul for the work to which I have called them." The church fasted, prayed, laid hands on them, and released them. Antioch became a pattern: a community of faith that hears the Spirit, multiplies leaders, and sends them into new frontiers.

Watch the movement. God sends. People go. Disciples are made. Community forms. Leaders emerge. Church is established. Church sends again. That is the bloodstream of Discover: Church Multiplication 101. Church is fruit of the work that came before it. The cycle starts with people being sent.

If you are a pioneer, let this settle you. You are stepping into something Jesus already started. If you are a lead pastor, let this search you. Antioch had a healthy church, and the Spirit still said send. Who is God raising up in your church that you may need to release?

### Reflection

1. Where is the Kingdom not yet established in your world? Name a people, a place, or a relational network, as specifically as you can.
2. As you read Matthew 28:19 and Acts 1:8, what is Jesus asking of you personally in this season?
3. If you lead a church: who among you already carries a burden for people you are not yet reaching? Write a name, even if the conversation has not happened yet.
4. Where have you assumed church was the starting point, when Scripture shows sending and disciple making coming first?

---
$s1v1_body$,
    'video',
    '',
    '',
    '',
    '',
    '',
    $s1v1_ref$1. Where is the Kingdom not yet established in your world? Name a people, a place, or a relational network, as specifically as you can.
2. As you read Matthew 28:19 and Acts 1:8, what is Jesus asking of you personally in this season?
3. If you lead a church: who among you already carries a burden for people you are not yet reaching? Write a name, even if the conversation has not happened yet.
4. Where have you assumed church was the starting point, when Scripture shows sending and disciple making coming first?$s1v1_ref$,
    true,
    20,
    true,
    1,
    now()
  ),
  (
    course_uuid,
    discover_module_uuid,
    $s1v2_title$Equipped for the Mission$s1v2_title$,
    $s1v2_sum$Ephesians 4:11-12, the fivefold gifts, and the sainthood of all believers.$s1v2_sum$,
    $s1v2_body$> Video placeholder: S1-V2 Equipped for the Mission (4:30). Not yet produced.

> Graphic placeholder: Fivefold Gifts Wheel. Center: Equipping the Saints. Ring: Pioneer, Guardian, Gatherer, Shepherd, Grounder. Outside: Multiplication. Apostle = Pioneer, Prophet = Guardian, Evangelist = Gatherer, Pastor = Shepherd, Teacher = Grounder.

> Graphic placeholder: Outward Movement Diagram with fivefold.

> Graphic placeholder: Two Church Comparison: Maintenance vs Multiplying.

You have seen that Jesus sends His people. Now look at how He equips the whole church for that sending.

Ephesians 4:11-12 says Christ "gave the apostles, the prophets, the evangelists, the pastors and teachers, to equip his people for works of service, so that the body of Christ may be built up." The gifts are for the saints. The saints do the work of ministry. That is the sainthood of all believers, and it belongs in the middle of any honest conversation about multiplication.

Ministry belongs to the whole body of Christ. Every believer is called to make disciples. Some are specifically called to pioneer. Every leader is called to raise up new leaders whom God may use as future pioneers. If you have been waiting for a title before you obey Matthew 28, you have been waiting for something Jesus did not require.

Look at the Fivefold Gifts Wheel. Hold the names in both languages, because the New Testament offices are functions in the life of the church:

- Apostle: Pioneer. Extends God's Kingdom into new places.
- Prophet: Guardian. Calls God's people back to faithfulness and keeps mission aligned with God.
- Evangelist: Gatherer. Proclaims the good news and gathers people to Jesus.
- Pastor: Shepherd. Cares for people, tends the flock, and helps disciples grow in health.
- Teacher: Grounder. Establishes believers in the truth of the Word.

The center of the wheel is Equipping the Saints. The rim is Multiplication. These gifts were never meant to be five jobs that keep a Sunday service running. They are Christ's way of preparing the whole body to join His mission.

Pastors help create healthy disciples. Teachers establish believers in truth. Evangelists help believers reach people who do not know Jesus. Prophetic ministry keeps the church attentive to God's voice and faithfulness. Apostolic ministry keeps the church moving outward into new people, places, and opportunities.

The apostolic call gives direction to all the gifts, moving the church outward into new places, forward into fresh opportunities, and multiplying new communities of faith. That is what the Outward Movement Diagram is trying to show you. Arrows leave the church. Pioneers start new works. Guardians keep those works aligned with God. Gatherers bring in the lost. Shepherds nurture new believers. Grounders root disciples in truth. The whole body is in motion.

Churches are living ecosystems. Every ecosystem needs balance. If one part is missing, the whole system suffers. Without pioneers the church loses vision and stops advancing into new territory. Without guardians the church loses alignment with God's voice and easily compromises. Without gatherers the church forgets the lost and turns inward. Without shepherds the church burns people out instead of caring for them. Without grounders the church drifts into immaturity and false doctrine.

When only pastors and teachers are emphasized, churches become focused on gathering and maintaining. Look at the Two Church Comparison. The maintenance church has the shepherd and the grounder working hard, and the arrows point inward. Gathering only. Inward focus. The multiplying church has all five active. The body is equipped. Mission faces outward. New communities form.

If you are a pioneer, you need the rest of the fivefold around you. Pioneering without shepherding and teaching leaves people wounded and thin. If you are a lead pastor, hear this with courage. Your shepherd gift is a gift. Your teaching gift is a gift. Those gifts, on their own, will tend what you already have. The apostolic, prophetic, and evangelistic functions pull the church outward into mission and multiplication. Ask who among you carries those outward gifts, and whether your culture makes room for them.

The fivefold is Christ's strategy for building a body that is both healthy and multiplying. It ensures that the whole church is equipped.

### Reflection

1. Which of the five functions do you most naturally live in: Pioneer, Guardian, Gatherer, Shepherd, or Grounder? Give one recent example.
2. Where is your church strong, and which function is thin? What happens in real life when that function is missing?
3. If you lead a church: are you equipping the saints for the work of ministry, or carrying most of the ministry yourself? What would need to change for saints to be sent?
4. Who around you might carry a pioneering or gathering gift that has been sitting in a maintenance role?

---
$s1v2_body$,
    'video',
    '',
    '',
    '',
    '',
    '',
    $s1v2_ref$1. Which of the five functions do you most naturally live in: Pioneer, Guardian, Gatherer, Shepherd, or Grounder? Give one recent example.
2. Where is your church strong, and which function is thin? What happens in real life when that function is missing?
3. If you lead a church: are you equipping the saints for the work of ministry, or carrying most of the ministry yourself? What would need to change for saints to be sent?
4. Who around you might carry a pioneering or gathering gift that has been sitting in a maintenance role?$s1v2_ref$,
    true,
    25,
    true,
    2,
    now()
  ),
  (
    course_uuid,
    discover_module_uuid,
    $s1v3_title$Establishing the Kingdom$s1v3_title$,
    $s1v3_sum$Apostolic work means establishing the Kingdom where it currently isn't.$s1v3_sum$,
    $s1v3_body$> Video placeholder: S1-V3 Establishing the Kingdom (3:45). Not yet produced.

The gifts equip the saints. The saints are sent. Sent to do what?

In this course, apostolic names the pioneering, missional call Jesus gave His followers. He sent them to go, to cross boundaries, and to form new communities of faith where the gospel has yet to take root. The wider church also uses the word for a denomination, a title, or a chain of succession. When you hear it here, hear this: establishing the Kingdom where it currently isn't.

That definition will stay with you for the rest of Discover: Church Multiplication 101. Apostolic leaders are sent ones. The Spirit sends them to bring the gospel into new territory, a neighborhood, a city, a culture, a people, even a nation. The word describes a call and a movement. Hold it there. You do not need a title on a business card to obey a sending God.

Paul named the impulse in Romans 15:20: "It has always been my ambition to preach the gospel where Christ was not known, so that I would not be building on someone else's foundation." He was drawn to the places still empty of the name of Jesus. That holy ambition still exists. Some of you feel it in your body when you drive through a part of town with no gospel community. Some of you feel it when you sit with a people group your church has never learned to love. Some of you lead churches that are full, and you can still feel the empty places around you.

Apostolic ministry involves people being sent, entering new communities, making disciples, forming communities of faith, developing leaders, establishing churches, and sending again. The work has a direction. It crosses a boundary. It stays long enough for disciples to become a people. It raises leaders. It is willing to let a new church stand on its own feet, and then it sends again.

If you are pioneering, this definition protects you from two ditches. One ditch is thinking the work is finished when you have a service. A service can exist while the Kingdom has still not taken root among the people you were sent to. The other ditch is thinking you must copy another church's foundation. Paul wanted to preach where Christ was not known. Your call is to a real people in a real place.

If you lead an existing church, this definition gives you a job. You already have a foundation. Your apostolic work now includes raising up sent ones for the foundations that do not yet exist. Establishing the Kingdom where it currently isn't may happen through you, and it may happen through people you release. Both are obedience.

Return to the question that opened this course. Where is the Kingdom not yet established in your world? Answer it with names, streets, and tables.

### Reflection

1. Where is the Kingdom not yet established in your world? Sharpen the answer you gave in Lesson 1. Make it more specific.
2. In your own words, what does "establishing the Kingdom where it currently isn't" mean for the people you can actually reach?
3. Where have you seen the word apostolic used for a denomination, a title, or a chain of succession? How does this course's meaning change the way you pray?
4. If you lead a church: which nearby people or place is still without a gospel community, and who in your body might be sent toward them?

---
$s1v3_body$,
    'video',
    '',
    '',
    '',
    '',
    '',
    $s1v3_ref$1. Where is the Kingdom not yet established in your world? Sharpen the answer you gave in Lesson 1. Make it more specific.
2. In your own words, what does "establishing the Kingdom where it currently isn't" mean for the people you can actually reach?
3. Where have you seen the word apostolic used for a denomination, a title, or a chain of succession? How does this course's meaning change the way you pray?
4. If you lead a church: which nearby people or place is still without a gospel community, and who in your body might be sent toward them?$s1v3_ref$,
    true,
    18,
    true,
    3,
    now()
  ),
  (
    course_uuid,
    discover_module_uuid,
    $s1v4_title$From Sent to Sending$s1v4_title$,
    $s1v4_sum$The cycle: missionaries sent, disciples made, community formed, church established, missionaries sent.$s1v4_sum$,
    $s1v4_body$> Video placeholder: S1-V4 From Sent to Sending (3:15). Not yet produced.

> Graphic placeholder: Circular cycle GIF (central). Cycle labels: Missionaries Sent to Disciples Made to Community Formed to Church Established to Missionaries Sent.

> Graphic placeholder: DNA graphic may recur. Disciples. Leaders. Churches. Caption: Multiplication is the original design of the church.

Once you know what apostolic work is, you can see the cycle.

Watch the circular GIF until the movement gets into your bones.

Missionaries Sent. Disciples Made. Community Formed. Church Established. Missionaries Sent.

That last step is the first step again. The circle is the point.

Someone is sent into a context. Relationships are built. The gospel is shared. Disciples are made. Disciples gather and community forms. Leaders emerge. A church may be established. That church becomes a sending community, and the cycle continues.

Church is fruit of missionary work that came before it. The cycle starts with people being sent. If you reverse the order, you will spend your best energy on a Sunday expression and hope disciples appear around it. The New Testament runs the other way. Sent people. New relationships. The gospel in those relationships. Disciples. A people. Leaders. Then a church that knows how to send.

Acts gives us a pattern. You will watch Paul enter cities. You will watch Philip go to Samaria. You will watch scattered believers carry the gospel. You will watch Lydia open her home in Philippi. You will watch Priscilla and Aquila gather believers in their home. The settings differed. The movement stayed consistent.

Philippi, Corinth, and Ephesus became more than first stops. Households like Lydia's became a supporting center for new churches. Corinth received the gospel and became a base in a hard city. Ephesus grew into a regional hub for new churches and Kingdom expansion. Communities of faith became centers for gospel expansion, leadership development, resources, and support. They learned to send.

Keep the phrases close. Disciples make disciples. Leaders develop leaders. Churches reproduce churches. That is the DNA you saw in Lesson 1, now moving in a circle.

If you are a pioneer, do not despise the early, quiet steps. Being sent. Learning names. Sharing Jesus. Making a first disciple. Those steps are the work. The church you hope to see will be fruit.

If you lead a church, locate yourselves on the circle. Are you still receiving, or are you sending? A church can be established and still refuse the last arrow. The GIF does not give you the option of a closed loop that ends at Church Established. The next word is Missionaries Sent.

### Reflection

1. Where are you on the cycle right now: being sent, making disciples, forming community, establishing church, or sending again? Tell the truth about it.
2. What happens in your thinking if church is fruit, the result of sending and disciple-making?
3. Name one relationship in which you could share the gospel and begin disciple making this month.
4. If you lead a church: where does your congregation get stuck on the circle, and what would it take to send again?

---
$s1v4_body$,
    'video',
    '',
    '',
    '',
    '',
    '',
    $s1v4_ref$1. Where are you on the cycle right now: being sent, making disciples, forming community, establishing church, or sending again? Tell the truth about it.
2. What happens in your thinking if church is fruit, the result of sending and disciple-making?
3. Name one relationship in which you could share the gospel and begin disciple making this month.
4. If you lead a church: where does your congregation get stuck on the circle, and what would it take to send again?$s1v4_ref$,
    true,
    20,
    true,
    4,
    now()
  ),
  (
    course_uuid,
    discover_module_uuid,
    $s1v5_title$What It Looks Like Today$s1v5_title$,
    $s1v5_sum$Four expressions of the same process in our day.$s1v5_sum$,
    $s1v5_body$> Video placeholder: S1-V5 What It Looks Like Today (3:30). Not yet produced.

> Graphic placeholder: Circular cycle GIF may recur small, as a reminder that the process has not changed.

Apostolic work is happening right now. The process you just watched in the cycle is the same process. The fruit can look different, because people and places differ.

Hold one question over every expression: Who is God sending us to, and how can we make disciples among them? Models come after that question. Models without that question become decoration.

### New churches in every context

A pioneer or team may be sent into a neighborhood, town, suburb, or city with a burden for the people who live there. The work begins with learning the community, building relationships, sharing the gospel, and making disciples. As disciples gather, a new community of faith begins to emerge. Leaders develop, and in time a new church may be established. The church is the fruit of missionary work that came before it. This can look like a congregation in a rented school, a storefront, a recovered building, or a network of homes that eventually takes public shape. The setting is secondary. The people are the point.

### House churches and micro churches

A handful of people may begin following Jesus together around a dinner table, an apartment, a workplace, a coffee shop, or another natural setting. As disciples mature, they begin reaching others, and new communities form. Church can begin with people learning to follow Jesus together and inviting others into that journey. Buildings, stages, and Sunday services may come later, or they may never be the center. The cycle still holds. Sent people. Disciples. Community. Leaders. Churches that send.

### Multi community churches

An established church may recognize another people group or community around them that is unlikely to be reached well through the existing congregation. This could include another language or ethnic community, a generation, a neighborhood, or another group with its own relational and cultural context. The church can raise up leaders and create space for a new community of faith to develop while remaining connected to the larger church family. Multiplication here looks like one church becoming a sending household for more than one people.

### Global disciple making movements

Simple, reproducible disciple making patterns can multiply across families, villages, neighborhoods, and people groups. A person encounters Jesus and learns to follow Him. That disciple shares what they are learning. New disciples begin making disciples. Communities form. Leaders emerge. Churches develop. The process continues. Ordinary believers obey Jesus, make disciples, develop others, and participate in Kingdom expansion. Highly trained workers still matter. They equip and send. They do not have to be present for every new disciple to take a next step.

Different fruit. Same process. Missionaries sent. Disciples made. Community formed. Church established. Missionaries sent.

If you are pioneering, stop hunting for the perfect model first. Name the people. Learn how disciples are actually made among them. Let the expression grow from that soil.

If you lead a church, you may already have more than one of these expressions in seed form. A dinner table. A language congregation. A team that could be sent across town. The question is still the same: Who is God sending us to, and how can we make disciples among them?

### Reflection

1. Who is God sending us to, and how can we make disciples among them? Answer as a pioneer, as a pastor, or as both.
2. Which modern expression most resembles the people and place you named in Lesson 3? Why that one, in that soil?
3. Where have you started with a model and hoped a people would gather around it? What would reverse that order?
4. What simple, reproducible disciple making practice could an ordinary believer among your people actually carry?

---
$s1v5_body$,
    'video',
    '',
    '',
    '',
    '',
    '',
    $s1v5_ref$1. Who is God sending us to, and how can we make disciples among them? Answer as a pioneer, as a pastor, or as both.
2. Which modern expression most resembles the people and place you named in Lesson 3? Why that one, in that soil?
3. Where have you started with a model and hoped a people would gather around it? What would reverse that order?
4. What simple, reproducible disciple making practice could an ordinary believer among your people actually carry?$s1v5_ref$,
    true,
    22,
    true,
    5,
    now()
  ),
  (
    course_uuid,
    discover_module_uuid,
    $s1v6_title$Where Do I Fit?$s1v6_title$,
    $s1v6_sum$Pioneer, sender, and team. Who is God raising up that you may need to release?$s1v6_sum$,
    $s1v6_body$> Video placeholder: S1-V6 Where Do I Fit? (3:15). Not yet produced.

By now the pattern is clear. The open question is where you stand in it.

Every follower of Jesus is called into the mission. Matthew 28:19 was given to disciples, and it still lands on every disciple. This flows from the sainthood of all believers. Every Christian is set apart, Spirit filled, and entrusted with God's mission. Every believer is called to represent Christ, carry His presence into the world, and multiply disciples.

While every disciple is called to make disciples, some are uniquely set apart for pioneering works, and every leader is called to raise up new leaders who God may use as future pioneers.

That sentence has three doors. Most of you will walk through more than one of them over a lifetime.

Some of you are pioneers. You feel the pull toward a people and a place where the Kingdom is not yet established. You can imagine being sent. You will spend Section 2 putting names, streets, and practices on that pull.

Some of you are senders. You lead an existing church, or you carry real influence in one. You may never move your household across town, and you are still in this course because multiplication in Acts required a sending church. Your work is to recognize, affirm, coach, release, and support the people God is raising up. The question I will keep asking you is this: Who is God raising up in your church that you may need to release?

Some of you will go as part of a team. Philip went. Barnabas went with Saul. Priscilla and Aquila opened their lives. You may be a shepherd, a grounder, a gatherer, or a guardian on a pioneering team. That is a real fit. The church needs you in the new place as much as in the old one.

Acts 13 is a picture of both calling and sending. The Spirit spoke. The church in Antioch recognized what God was doing, laid hands on Barnabas and Saul, and released them. A preexisting church stepped into its apostolic role. The call was personal and it was communal. If you think you are called, you still need a people who will fast, pray, and send. If you lead a church, you still need to make room for the Spirit to say, "Set apart."

You will work the marks of a call more carefully in Section 2: burden, confirmation, and fruit. For now, notice whether any of those marks are already present. A Spirit-given ache for a people. Leaders who see something in you. Evidence that God already works through you to make disciples.

You fit somewhere in this story. Discover: Church Multiplication 101 exists to help you name that place with humility and courage, and then take a next step with the church around you.

### Reflection

1. Which door is yours in this season: pioneer, sender, team, or a mix? Say why.
2. While every disciple is called to make disciples, some are uniquely set apart for pioneering works. Does that second clause describe you, someone you lead, or both?
3. Who is God raising up in your church that you may need to release? If you are the one being raised up, who would need to release you?
4. What would it look like for your church to fast, pray, and lay hands on sent ones the way Antioch did?

---
$s1v6_body$,
    'video',
    '',
    '',
    '',
    '',
    '',
    $s1v6_ref$1. Which door is yours in this season: pioneer, sender, team, or a mix? Say why.
2. While every disciple is called to make disciples, some are uniquely set apart for pioneering works. Does that second clause describe you, someone you lead, or both?
3. Who is God raising up in your church that you may need to release? If you are the one being raised up, who would need to release you?
4. What would it look like for your church to fast, pray, and lay hands on sent ones the way Antioch did?$s1v6_ref$,
    true,
    18,
    true,
    6,
    now()
  ),
  (
    course_uuid,
    discover_module_uuid,
    $s1v7_title$Your Next Step$s1v7_title$,
    $s1v7_sum$Credentialing, the Discernment Center, and a preview of the Ministry Readiness Inventory in Section 4.$s1v7_sum$,
    $s1v7_body$> Video placeholder: S1-V7 Your Next Step (3:00). Not yet produced.

A call grows clearer as you walk. Open Bible has pathways for that walking. Use what is public and current. Talk to people who can walk with you. Leave the rest with the Lord and with your leaders.

### Serve and speak up

If you believe God is calling you, pray. Counsel with your pastor and other spiritually mature people. If they encourage you, consult with your Open Bible regional credentials advisor. In the meantime, roll up your sleeves. Be committed to your church's ministries. Serve while you are learning how He can use you. Vocational ministry begins in that service, well before a credential is in your hand.

If you lead a church, this is part of your job. Make it easy for emerging pioneers to serve, to be seen, and to be told the truth. You are the first confirmation many of them will receive.

### Credentialing with Open Bible

Credentialing provides recognition, accountability, belonging, resources, support, and covering for ministry leaders. It can affirm and support those stepping into ministry leadership.

Start where the official page starts. Step one is the Getting Acquainted form. Talk with your pastor, then with your regional credentials advisor. Serve locally while you discern.

The live credentials page (https://www.openbible.org/connect/credentials) names these levels:

- Ministerial Credential. This is an entry level credential.
- Certified Ministerial Credential. For ministers with additional seasoning and development of ministerial competencies.
- Ordination. Conferred upon ministers who have achieved three or more additional years of faithfulness and fruitfulness in leadership, who have refined their ministerial competencies.

Pathways of preparation named on that page include Inste Global Bible College (local church facilitated and online), Discover Ministry School (live stream), Harvest Bible Institute (Des Moines, Iowa), Legacy School of Ministry (Rapid City, South Dakota), Toledo School of Ministry (Toledo, Ohio), Acquire (Open Bible's online ministerial training and coaching program), and completion of an approved non-Open Bible college, institute, or school of ministry.

Fees, extra assessments, and internal approval steps can change. Do not treat a number you heard in a hallway as policy. Use the official page, and ask your regional credentials advisor for the current process.

### The Discernment Center

The Discernment Center is a prayerful and practical environment designed to help ministry pioneers and planters gain a 360 degree view of their calling, gifting, and readiness. It is a two-and-a-half-day experience. Couples and teams participate. Interviews, assessments, and group interactions help reveal strengths, challenges, and areas for growth. A team of leaders works with participants throughout the process. Leaders listen, encourage, and provide honest feedback. Participants receive guidance about next steps. The Discernment Center is primarily designed for ministry pioneers and planters.

Lead pastors: if you are raising up pioneers, send them to the Discernment Center and join them as a coach leader. Your presence tells your people that sending is the church's work, not a solo adventure.

For more information, talk with your Regional Director of Multiplication. Dates, cost, and a public URL were not on a live page when this course was written. Your regional leader can point you to the next gathering.

### The Ministry Readiness Inventory is ahead

Section 4 of Discover: Church Multiplication 101 will send you to the Ministry Readiness Inventory, the native CMC Pathway assessment. You do not need to take it yet. Finish Sections 2 and 3 first so calling and Open Bible's vision are in view before you sit with an assessment.

If you lead a church, you may be walking a pioneer toward that assessment. Stay in the conversation. Assessments are tools. They do not replace the Spirit, the church, or a long obedience.

### Keep walking

Your next step may be a conversation with your pastor. It may be the Getting Acquainted form. It may be a name you need to release. It may be prayer over a people who still have no gospel community. Take the step that is actually in front of you.

I will keep walking with you through the rest of Discover: Church Multiplication 101.

### Reflection

1. What is the next concrete step you will take in the next two weeks? Name it so another person could hold you to it.
2. Who will you talk with: pastor, regional credentials advisor, Regional Director of Multiplication, or a pioneer you need to release?
3. If credentialing is before you, have you opened [https://www.openbible.org/connect/credentials](https://www.openbible.org/connect/credentials) and noted the first step?
4. Where is the Kingdom not yet established in your world, and how does this next step move you toward that place?

### Links for this lesson

- Credentialing (official): [https://www.openbible.org/connect/credentials](https://www.openbible.org/connect/credentials)
- Who We Are (you will read this more fully in Section 3): [https://www.openbible.org/about/who-we-are](https://www.openbible.org/about/who-we-are)
$s1v7_body$,
    'video',
    '',
    '',
    '',
    $s1v7_rurl$https://www.openbible.org/connect/credentials$s1v7_rurl$,
    $s1v7_rlab$Open Bible credentialing$s1v7_rlab$,
    $s1v7_ref$1. What is the next concrete step you will take in the next two weeks? Name it so another person could hold you to it.
2. Who will you talk with: pastor, regional credentials advisor, Regional Director of Multiplication, or a pioneer you need to release?
3. If credentialing is before you, have you opened https://www.openbible.org/connect/credentials and noted the first step?
4. Where is the Kingdom not yet established in your world, and how does this next step move you toward that place?$s1v7_ref$,
    true,
    22,
    true,
    7,
    now()
  );
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
    calling_module_uuid,
    $s2v1_title$Called Into the Missio Dei$s2v1_title$,
    $s2v1_sum$The general call, the pioneer call, and the leader call to raise future pioneers.$s2v1_sum$,
    $s2v1_body$> Video placeholder: S2-V1 Called Into the Missio Dei (3:00). Not yet produced.

In every generation God invites His people to share in His missio Dei, the sending activity of God in the world. God is the one who sends. The Father sent the Son. The Son sends us in the power of the Spirit. We join a mission that was underway before we felt anything.

Each believer is drawn into the general call to follow Jesus and make disciples. Some are also set apart for pioneering new works that carry the gospel into new places and form new communities. In this section we will look at how God calls, how that call is recognized and affirmed, and how a call takes on flesh among a particular people.

While every disciple is called to make disciples, some are uniquely set apart for pioneering works, and every leader is called to raise up new leaders who God may use as future pioneers.

Sit with that line. It keeps three truths together so none of them gets lost.

The general call is real. If you belong to Jesus, you are already in the mission. Matthew 28:19 does not wait for a platform. You make disciples where you live, work, and belong.

The pioneer call is real. Some are uniquely set apart for pioneering works. In Acts 13 the Spirit said, "Set apart for me Barnabas and Saul for the work to which I have called them." The work had a shape. New places. New communities. A particular assignment inside the wider call.

The leader call is real. Every leader is called to raise up new leaders who God may use as future pioneers. If you shepherd a church, this is not extra credit. This is part of how you obey Jesus. You may never leave your city, and you may still be the reason a pioneer gets released.

Missio Dei protects you from making calling a personality project. God is already at work in the world. Your work is to join Him among a people. If you are a pioneer, you are looking for the people He is sending you to. If you lead a church, you are looking for the people He is sending from among you, and the people He is sending you toward as a congregation.

Calling in Discover: Church Multiplication 101 will stay concrete. People. Place. Relationships. Context. We will leave this section with a field.

### Reflection

1. Where do you already see the missio Dei around you, God at work before you arrived?
2. Which part of the specific-call line is the Holy Spirit pressing on you right now: every disciple making disciples, some set apart to pioneer, or every leader raising future pioneers?
3. Who first named a call in you, and what did they actually see?
4. If you lead a church: how is your leadership currently raising up people God might send?

---
$s2v1_body$,
    'video',
    '',
    '',
    '',
    '',
    '',
    $s2v1_ref$1. Where do you already see the missio Dei around you, God at work before you arrived?
2. Which part of the specific-call line is the Holy Spirit pressing on you right now: every disciple making disciples, some set apart to pioneer, or every leader raising future pioneers?
3. Who first named a call in you, and what did they actually see?
4. If you lead a church: how is your leadership currently raising up people God might send?$s2v1_ref$,
    true,
    16,
    true,
    0,
    now()
  ),
  (
    course_uuid,
    calling_module_uuid,
    $s2v2_title$Who Are You Called To Reach?$s2v2_title$,
    $s2v2_sum$People, place, relationships, and context for a real field.$s2v2_sum$,
    $s2v2_body$> Video placeholder: S2-V2 Who Are You Called To Reach? (3:15). Not yet produced.

Calling is people, place, relationships, and context. Start there.

Who are you called to reach? Say it out loud. A neighborhood. A network of coworkers. A language community. A campus. A set of villages. A generation your church never learned to hear. "Everybody" is too large to obey this week. Jesus loves the world, and He still sent people to particular places.

What is their context? How do they spend time? Who do they trust? What do they fear? What is already preached to them by the culture around them? What would a disciple of Jesus look like among them in six months, in two years? You cannot make disciples in a context you refuse to learn.

What relationships already exist? God often calls along lines He has already drawn. Relatives. Friends. People you work beside. A community you used to belong to. A people whose food and language you already know. New relationships will be needed too. Begin with the ones that are already a gift.

How might discipleship look among them? The shape of disciple making should fit the life of the people. A lunch hour. A living room. A walk. A trades workday. A group of mothers. A WhatsApp thread that becomes prayer and Scripture and obedience. If your only picture of discipleship is a midweek class in a church building, you may be asking people to become someone else before they can follow Jesus.

What kind of community could form among those disciples? When people start obeying Jesus together, they will need each other. That community might become a house church, a micro church, a new congregation, a language community inside a sending church, or a network that multiplies. Let the people and the gospel set the pace. Section 1 taught you the cycle. This lesson asks you to imagine that cycle among a named people.

How can churches release multiplication in that context? A pioneer without a sending people is exposed. A church that never asks this question will keep adding programs for the people it already has. Lead pastors, this is your page as much as anyone's. You may be called to a people your current gathering will never reach well. You may also be called to release someone who is.

Write until it gets specific. If you cannot yet name a people, pray and talk with your pastor or a trusted leader until a field comes into view. Calling alignment happens on the ground.

### Reflection

1. Who are you called to reach? Name them as specifically as you can. If you lead a church, name both a people your congregation is called to and a people you may need to send someone toward.
2. What is their context, and what would you need to learn that you do not know yet?
3. Which existing relationships could become the first table of disciple making?
4. If disciples were made among them, what kind of community would most naturally form, and how could your church release that?

---
$s2v2_body$,
    'video',
    '',
    '',
    '',
    '',
    '',
    $s2v2_ref$1. Who are you called to reach? Name them as specifically as you can. If you lead a church, name both a people your congregation is called to and a people you may need to send someone toward.
2. What is their context, and what would you need to learn that you do not know yet?
3. Which existing relationships could become the first table of disciple making?
4. If disciples were made among them, what kind of community would most naturally form, and how could your church release that?$s2v2_ref$,
    true,
    22,
    true,
    1,
    now()
  ),
  (
    course_uuid,
    calling_module_uuid,
    $s2v3_title$Marks of a Call$s2v3_title$,
    $s2v3_sum$Burden, confirmation, and fruit, including a sending-church example.$s2v3_sum$,
    $s2v3_body$> Video placeholder: S2-V3 Marks of a Call (3:45). Not yet produced.

God speaks in more than one way, and He often confirms a call through more than one witness. Skip hunting for a dramatic story. Pay attention. In Discover: Church Multiplication 101 we watch for three marks: burden, confirmation, and fruit.

### Burden

Burden is a Spirit-given desire or holy discontent to see something change or begin. It can feel like Paul's compulsion to preach. It can feel like a broken heart for people who do not know Jesus. It can feel like a weight that does not lift when you pray for a particular street or people.

Sometimes the Spirit gives a burden to start new churches in unreached places. In other cases, that burden is felt by a lead pastor who recognizes that God has raised up leaders within their congregation to be sent out. Both burdens are holy. One says, "Send me." The other says, "We have to release them."

A burden should be tested. Infatuation with a model can dress itself up as a call. Frustration with your current church can dress itself up as a call. Ask whether the ache is for a people, and whether it remains when the spotlight is gone.

### Confirmation

Confirmation is affirmation from spiritual leaders and the wider body of Christ. In Acts 13 the church heard the Spirit and agreed. They fasted, prayed, laid hands, and sent. The call was Spirit directed and confirmed through the church community.

This is more than friends blessing whatever you already wanted. Key people recognize that God is shaping you for service. They have watched your character, your relationships, your handling of the Word, and your way with people. If you think you are called and no mature believer can see it, slow down. If several mature believers see it and you are still hiding, that is also information.

Lead pastors, confirmation is one of your ministries. Existing churches recognize, affirm, lay hands, release, and support. You may be the difference between a pioneer who walks alone and a pioneer who is sent.

### Fruit

Fruit is evidence of God working through someone's life. People coming to faith. A pattern of disciple making. Leadership influence that helps others grow. Peace and endurance in the work. Fruit can be early and small. It should still be real.

A call to pioneer will usually show up first as someone who already makes disciples, already crosses a boundary, already gathers people around Jesus, already raises someone else up. Wait for that pattern. Do not wait forever for a perfect resume.

When a church affirms a call, lays hands on those leaders, and releases them into new works, confirmation is clear. The fruit is seen when those pioneers start new ministries, form new communities of faith, and, in time, see churches established. The sending church also bears fruit, because multiplication has flowed out of its body into new places.

Burden. Confirmation. Fruit. Hold all three. A burden without confirmation can isolate you. Confirmation without fruit can be flattery. Fruit without a sending church can leave you exposed. Together they help you step into God's mission with confidence, clarity, and humility.

### Reflection

1. What burden has the Spirit given you, and for which people?
2. Who has confirmed something in you, and what did they confirm? If the list is empty, who will you invite to tell you the truth?
3. What fruit is already present: disciples, leaders developing, people coming to faith, a pattern of crossing toward the lost?
4. If you lead a church: whose burden have you been quietly noticing, and what would confirmation from you actually look like?

---
$s2v3_body$,
    'video',
    '',
    '',
    '',
    '',
    '',
    $s2v3_ref$1. What burden has the Spirit given you, and for which people?
2. Who has confirmed something in you, and what did they confirm? If the list is empty, who will you invite to tell you the truth?
3. What fruit is already present: disciples, leaders developing, people coming to faith, a pattern of crossing toward the lost?
4. If you lead a church: whose burden have you been quietly noticing, and what would confirmation from you actually look like?$s2v3_ref$,
    true,
    18,
    true,
    2,
    now()
  ),
  (
    course_uuid,
    calling_module_uuid,
    $s2v4_title$The Church That Sends$s2v4_title$,
    $s2v4_sum$Acts 13 as calling and sending. How a preexisting church releases multiplication.$s2v4_sum$,
    $s2v4_body$> Video placeholder: S2-V4 The Church That Sends (3:30). Not yet produced.

> Graphic placeholder: Circular cycle GIF optional, as a reminder that Church Established leads to Missionaries Sent.

Acts 13 is calling and sending in the same story. The Spirit sets apart. The church fasts, prays, lays hands, and releases. Barnabas and Saul go. A preexisting church steps into its apostolic role.

That picture is the heart of this lesson. Pioneers need a people who will send them. Churches need the courage to release them. Discover: Church Multiplication 101 holds both in the same room.

How can churches release multiplication?

They can watch. Leaders look for burden, confirmation, and fruit in the body instead of waiting for a stranger to apply from outside.

They can name. A lead pastor says out loud, "I think God may be calling you to a people we are not yet reaching." Silence is easier. Silence also buries gifts.

They can train. Saints are equipped for the work of ministry. Pioneers and teams get disciple-making practice, shepherding, and honest coaching while they are still in the sending church.

They can lay hands and release. Fasting and prayer are part of the work. So is letting go of people you would rather keep. Support follows them: prayer, relationship, counsel, and in many cases practical help. Release is a continuing posture.

They can stay in their apostolic role after the team leaves. The sending church keeps making disciples, keeps developing leaders, and keeps asking who is next. The circle continues. Missionaries sent.

If you are a pioneer, honor the church that sends you. Receive covering. Stay teachable. Honor them as family all the way through the sending.

If you lead a church, this is your apostolic work in the place you already are. You raise up, coach, release, and send. You use the existing church as a launching base. You create a culture where multiplication is normal. You may feel the cost in empty seats and thinner volunteer lists. Antioch felt a cost too. They still laid hands on their best.

The sainthood of all believers tells us that ministry belongs to the whole body of Christ. Every believer is called to make disciples, and some are specifically called to pioneer. Recognizing the marks of a call, and walking through discernment with the church, helps us step into God's mission with confidence, clarity, and humility.

Who is God raising up in your church that you may need to release? If that question has a name on it, you already know your next conversation.

### Reflection

1. What would it take for your church to function like Antioch: hearing the Spirit, laying on hands, and sending?
2. If you are a pioneer, who is your sending church, and what do you still need to receive from them?
3. If you lead a church, who is God raising up that you may need to release, and what support would you give after you lay hands on them?
4. Where does your church currently stop on the cycle, and what is the next sending step you can take this season?
$s2v4_body$,
    'video',
    '',
    '',
    '',
    '',
    '',
    $s2v4_ref$1. What would it take for your church to function like Antioch: hearing the Spirit, laying on hands, and sending?
2. If you are a pioneer, who is your sending church, and what do you still need to receive from them?
3. If you lead a church, who is God raising up that you may need to release, and what support would you give after you lay hands on them?
4. Where does your church currently stop on the cycle, and what is the next sending step you can take this season?$s2v4_ref$,
    true,
    18,
    true,
    3,
    now()
  );
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
    vision_module_uuid,
    $s3v1_title$Our Mission and Vision$s3v1_title$,
    $s3v1_sum$Official Who We Are mission and vision: make disciples, develop leaders, multiply churches.$s3v1_sum$,
    $s3v1_body$> Video placeholder: S3-V1 Our Mission and Vision (3:15). Not yet produced.

You have been watching a biblical pattern. Now look at the family you may walk this out with.

Open Bible Churches is an association of churches and ministers who believe we can accomplish more for the Kingdom together than we can alone. Our churches keep their unique identities and local ministries while sharing relationship, resources, accountability, and a common mission. Across regions, nations, cultures, and generations, we are one Open Bible family, working together to help people know Jesus and advance His Kingdom.

I want you to hear our mission and vision the way we currently state them. This is the official language from Who We Are, and it is the language Discover: Church Multiplication 101 uses.

**Mission:** Open Bible Churches exists to globally make disciples, develop leaders, and multiply churches.

**Vision:** We see life-giving, disciple-making, Spirit-empowered Open Bible churches in every state and 100 countries around the world, possessing a missional mindset, a multiplying priority, and a mobilizing commitment.

Read those lines slowly. Make disciples. Develop leaders. Multiply churches. That triad is the same bloodstream you have been tracing since Section 1. Disciples make disciples. Leaders develop leaders. Churches reproduce churches.

The vision has a geography: every state, and 100 countries. It has a character: life-giving, disciple-making, Spirit-empowered. It has a posture: missional mindset, multiplying priority, mobilizing commitment. If you pioneer with Open Bible, this is the horizon you are aiming at. If you lead an Open Bible church, this is the horizon your congregation is already claimed by.

You may have seen older lines that said "plant churches." Some Open Bible pages still use that phrase. In this course we stay with Who We Are: multiply churches. Planting can be one expression of multiplying. Multiplying is the larger word, and it matches the cycle. Churches that send. Churches that reproduce. Churches that make room for more than one kind of fruit.

If the mission and vision image is on the page in front of you, sit with it. Let the words land. Then ask how your people and your place fit inside that picture.

### Reflection

1. In your own words, what does it mean that Open Bible exists to globally make disciples, develop leaders, and multiply churches?
2. Where does the vision (every state and 100 countries, missional, multiplying, mobilizing) stretch your current prayers?
3. If you are pioneering, how would your work among a particular people serve this mission, and keep it from shrinking into only a personal dream?
4. If you lead a church, which part of the vision is already alive among you, and which part still needs a sent one?

---
$s3v1_body$,
    'video',
    '',
    '',
    '',
    $s3v1_rurl$https://www.openbible.org/about/who-we-are$s3v1_rurl$,
    $s3v1_rlab$Open Bible Who We Are$s3v1_rlab$,
    $s3v1_ref$1. In your own words, what does it mean that Open Bible exists to globally make disciples, develop leaders, and multiply churches?
2. Where does the vision (every state and 100 countries, missional, multiplying, mobilizing) stretch your current prayers?
3. If you are pioneering, how would your work among a particular people serve this mission, and keep it from shrinking into only a personal dream?
4. If you lead a church, which part of the vision is already alive among you, and which part still needs a sent one?$s3v1_ref$,
    true,
    16,
    true,
    0,
    now()
  ),
  (
    course_uuid,
    vision_module_uuid,
    $s3a2_title$Make Disciples, Develop Leaders, Multiply Churches$s3a2_title$,
    $s3a2_sum$The mission as a way of life, and MULTIPLY value P: sending capacity.$s3a2_sum$,
    $s3a2_body$The mission is a sequence you already know. I want you to feel it as a way of life for a church.

Make disciples. That is Matthew 28:19 in Open Bible clothes. It is the first movement after someone is sent. If we multiply gatherings without making disciples, we have grown an audience. If we make disciples who make disciples, churches will follow as fruit.

Develop leaders. Multiplication stalls when everything depends on one gifted person. Open Bible names training and leadership development as part of who we are. Pastors, planters, emerging leaders, and everyday disciples all need to be discovered, developed, and deployed. If you lead a church, look at who is being developed. If you are a pioneer, look at who you are already raising up beside you. The work is bigger than you.

Multiply churches. Church is fruit of the work that came before it. We multiply churches because disciples gather, leaders emerge, and new communities of faith take root where the Kingdom was missing. We also multiply churches because established churches send again. Your congregation can be part of that sending even if the new community does not look like your Sunday.

Our core values are captured in one word: MULTIPLY. Each letter represents a value that shapes who we are. I am not going to walk you through all eight letters as a separate course. I want one of them in your bones before you leave this section.

P is Progress Over Preservation. The official language says Mission to Multiply calls us to embrace faith-filled change, release leaders, and measure fruit not only by seating capacity but by sending capacity.

Sending capacity. That is a scoreboard a multiplying church can live with. How many saints are equipped? How many leaders are being developed? How many people are we prepared to release? Who is God raising up in your church that you may need to release?

If you are a pioneer, sending capacity is also about the church that stands behind you. Ask whether you are connected to a people who will send, cover, and keep multiplying after you go.

If you lead a church, try this as a quiet audit. Seating capacity tells you how many you can gather. Sending capacity tells you whether the cycle is still turning.

Open Bible is a Spirit-empowered family with a multiplying priority. Discover: Church Multiplication 101 exists to help you find your place in that priority, among a real people, with a sending church beside you.

Next you will take the Ministry Readiness Inventory in Pathway, a tool that can give you language for readiness. The mission and the vision stay first. Tools serve the call. The call belongs to God.

### Reflection

1. Where is your life currently strong: making disciples, developing leaders, or multiplying churches? Where is it thin?
2. What would "sending capacity" look like in your church in the next twelve months? Name a number of people, a people group, or a team.
3. How does Progress Over Preservation challenge a preference for comfort in your leadership or in your pioneering plans?
4. Before you take the Ministry Readiness Inventory, write one sentence: How I believe God is inviting me to serve Open Bible's mission to make disciples, develop leaders, and multiply churches.
$s3a2_body$,
    'article',
    '',
    '',
    '',
    '',
    '',
    $s3a2_ref$1. Where is your life currently strong: making disciples, developing leaders, or multiplying churches? Where is it thin?
2. What would "sending capacity" look like in your church in the next twelve months? Name a number of people, a people group, or a team.
3. How does Progress Over Preservation challenge a preference for comfort in your leadership or in your pioneering plans?
4. Before you take the Ministry Readiness Inventory, write one sentence: How I believe God is inviting me to serve Open Bible's mission to make disciples, develop leaders, and multiply churches.$s3a2_ref$,
    true,
    12,
    true,
    1,
    now()
  );
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
    mri_module_uuid,
    $s4v1_title$Take the Ministry Readiness Inventory$s4v1_title$,
    $s4v1_sum$Native CMC Pathway Ministry Readiness Inventory at ministry-readiness.html. Assignment key ministry_readiness. No outside account. No fee.$s4v1_sum$,
    $s4v1_body$> Video placeholder: S4-V1 Take the Ministry Readiness Inventory (3:00). Not yet produced.

You have walked the biblical pattern. You have started to name a people and a place. You have heard Open Bible's mission to globally make disciples, develop leaders, and multiply churches. Now take a tool that can give you a preliminary look at readiness.

This one lives inside CMC Pathway. It is called the Ministry Readiness Inventory. You will not create an outside account. You will not pay a fee. You take it here, logged in, as part of this pathway.

The inventory walks through eighty-five questions. Most people finish in about twenty minutes. It reviews practical ministry experience, leadership initiative, church multiplication exposure, and relational evangelism. The report names four areas:

- Church Planting
- Entrepreneurial Leadership
- Ministry Experience
- Relational Evangelism

If this course step opens the inventory for you, start it from here. If you do not see it yet, a regional leader can assign the Ministry Readiness Inventory to you in Pathway. Ask your Regional Director of Multiplication if you are stuck.

Answer honestly. Resist the urge to perform. You want a true reading. This inventory does not decide whether God has called you. It does not replace the Spirit, the Word, your church, or a long obedience. Pathway's own report language is right: it does not determine calling, character, or final approval by itself. It gives you and CMC leaders a starting point for better conversation, coaching, and discernment.

When you finish, Pathway saves the report. You can open it. Your leaders can see it. Then come back here and write from what you learned.

If you are a pioneer, take it with a quiet heart.

If you lead a church, walk with the person you are sending. Read the results together. Ask what the Spirit and the church are saying alongside the numbers. If a leader has also assigned this inventory to you as a sender, take it as a pastor who raises up pioneers. The four areas can help you see what you already carry and what you need on a team.

### How to complete this lesson

1. Watch S4-V1 if you have not already.
2. Open the Ministry Readiness Inventory in CMC Pathway. Use this course step if it is wired to the assessment. If it is not on your dashboard yet, ask your regional leader to assign it.
3. Complete all eighty-five questions. Progress saves as you go.
4. Review your report.
5. Return and answer the reflection prompts.

### Reflection

1. What did the Ministry Readiness Inventory affirm that matches burden, confirmation, or fruit you have already seen?
2. Which of the four areas felt thinnest, and what is one humble next step (training, a teammate, more disciple making, more time in your sending church)?
3. Who will you talk with about these results: pastor, sending church, Regional Director of Multiplication, or a trusted leader?
4. Where is the Kingdom not yet established in your world, and how do these results shape the way you will move toward that people?

### Host note

Whether this Discover course step can open or assign the inventory itself, whether senders take it, and whether completion is required to finish Discover are not decided in this course. Do not invent that policy. Assignment key: ministry_readiness. Page: ministry-readiness.html. A regional leader can assign it in Pathway.

### Link

- Ministry Readiness Inventory: [Open the inventory](/ministry-readiness.html)
$s4v1_body$,
    'video',
    '',
    '',
    '',
    $s4v1_rurl$https://pathway.openbiblecmc.org/ministry-readiness.html$s4v1_rurl$,
    $s4v1_rlab$Ministry Readiness Inventory$s4v1_rlab$,
    $s4v1_ref$1. What did the Ministry Readiness Inventory affirm that matches burden, confirmation, or fruit you have already seen?
2. Which of the four areas felt thinnest, and what is one humble next step (training, a teammate, more disciple making, more time in your sending church)?
3. Who will you talk with about these results: pastor, sending church, Regional Director of Multiplication, or a trusted leader?
4. Where is the Kingdom not yet established in your world, and how do these results shape the way you will move toward that people?$s4v1_ref$,
    true,
    35,
    true,
    0,
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
