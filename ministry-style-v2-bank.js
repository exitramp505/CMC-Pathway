/* Original CMC Ministry Style Inventory v2 item bank.
 * This is a coaching inventory, not a licensed or psychometrically validated Everything DiSC assessment.
 * IDs and wording are intentionally stable once results are stored.
 */
(function(root,factory){
  const bank=factory();
  if(typeof module==="object"&&module.exports) module.exports=bank;
  if(root) root.CMCMinistryStyleV2Bank=bank;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const STYLES=["pioneer","mobilizer","shepherd","steward"];
  const ITEMS=[
  {
    "id": "A01",
    "kind": "agreement",
    "style": "pioneer",
    "text": "I am comfortable taking the first step before every detail is settled.",
    "context": "Initiative",
    "reverse": false
  },
  {
    "id": "A02",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "I enjoy bringing people together around a shared possibility.",
    "context": "Church multiplication",
    "reverse": false
  },
  {
    "id": "A03",
    "kind": "agreement",
    "style": "shepherd",
    "text": "I notice when someone in a group has not yet been heard.",
    "context": "Relationships",
    "reverse": false
  },
  {
    "id": "A04",
    "kind": "agreement",
    "style": "steward",
    "text": "I like turning a broad vision into clear responsibilities and steps.",
    "context": "Execution",
    "reverse": false
  },
  {
    "id": "A05",
    "kind": "agreement",
    "style": "pioneer",
    "text": "When a group is stuck, I tend to suggest a concrete next step.",
    "context": "Decision-making",
    "reverse": false
  },
  {
    "id": "A06",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "I tend to notice what excites a group and build on it.",
    "context": "Team dynamics",
    "reverse": false
  },
  {
    "id": "A07",
    "kind": "agreement",
    "style": "shepherd",
    "text": "I make time to understand how a change will affect people.",
    "context": "Change",
    "reverse": false
  },
  {
    "id": "A08",
    "kind": "agreement",
    "style": "steward",
    "text": "I naturally notice details that others might overlook.",
    "context": "Execution",
    "reverse": false
  },
  {
    "id": "A09",
    "kind": "agreement",
    "style": "pioneer",
    "text": "I naturally take responsibility when a difficult choice must be made.",
    "context": "Decision-making",
    "reverse": false
  },
  {
    "id": "A10",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "People often look to me to help a group regain momentum.",
    "context": "Team dynamics",
    "reverse": false
  },
  {
    "id": "A11",
    "kind": "agreement",
    "style": "shepherd",
    "text": "I value a steady relationship more than a quick short-term result.",
    "context": "Relationships",
    "reverse": false
  },
  {
    "id": "A12",
    "kind": "agreement",
    "style": "steward",
    "text": "I prefer defining expectations before asking a team to begin work.",
    "context": "Team dynamics",
    "reverse": false
  },
  {
    "id": "A13",
    "kind": "agreement",
    "style": "pioneer",
    "text": "I prefer forward movement to meetings that end without decisions.",
    "context": "Execution",
    "reverse": false
  },
  {
    "id": "A14",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "I naturally communicate enthusiasm about a new vision.",
    "context": "Communication",
    "reverse": false
  },
  {
    "id": "A15",
    "kind": "agreement",
    "style": "shepherd",
    "text": "When someone feels discouraged, I usually slow down and listen.",
    "context": "Relationships",
    "reverse": false
  },
  {
    "id": "A16",
    "kind": "agreement",
    "style": "steward",
    "text": "I look for foreseeable risks before launching a new initiative.",
    "context": "Church multiplication",
    "reverse": false
  },
  {
    "id": "A17",
    "kind": "agreement",
    "style": "pioneer",
    "text": "Starting a new ministry energizes me even when outcomes are uncertain.",
    "context": "Church multiplication",
    "reverse": false
  },
  {
    "id": "A18",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "I prefer exploring ideas with people to developing them entirely alone.",
    "context": "Communication",
    "reverse": false
  },
  {
    "id": "A19",
    "kind": "agreement",
    "style": "shepherd",
    "text": "I prefer helping people grow patiently over pushing for immediate progress.",
    "context": "Disciple-making",
    "reverse": false
  },
  {
    "id": "A20",
    "kind": "agreement",
    "style": "steward",
    "text": "I find satisfaction in improving a system that does not work well.",
    "context": "Execution",
    "reverse": false
  },
  {
    "id": "A21",
    "kind": "agreement",
    "style": "pioneer",
    "text": "I prefer addressing a problem directly rather than postponing it.",
    "context": "Conflict",
    "reverse": false
  },
  {
    "id": "A22",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "During discouraging seasons, I remind others of what is still possible.",
    "context": "Pressure",
    "reverse": false
  },
  {
    "id": "A23",
    "kind": "agreement",
    "style": "shepherd",
    "text": "I try to build trust before asking someone to take a significant risk.",
    "context": "Church multiplication",
    "reverse": false
  },
  {
    "id": "A24",
    "kind": "agreement",
    "style": "steward",
    "text": "When decisions are difficult, I examine evidence and assumptions.",
    "context": "Decision-making",
    "reverse": false
  },
  {
    "id": "A25",
    "kind": "agreement",
    "style": "pioneer",
    "text": "I usually challenge a team to set ambitious, stretching goals.",
    "context": "Team dynamics",
    "reverse": false
  },
  {
    "id": "A26",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "I try to help newcomers feel personally invited into the mission.",
    "context": "Relationships",
    "reverse": false
  },
  {
    "id": "A27",
    "kind": "agreement",
    "style": "shepherd",
    "text": "In conflict, I want each person to feel understood before moving forward.",
    "context": "Conflict",
    "reverse": false
  },
  {
    "id": "A28",
    "kind": "agreement",
    "style": "steward",
    "text": "I am attentive to whether ministry resources are being used responsibly.",
    "context": "Stewardship",
    "reverse": false
  },
  {
    "id": "A29",
    "kind": "agreement",
    "style": "pioneer",
    "text": "When a plan changes suddenly, I quickly choose a new direction.",
    "context": "Change",
    "reverse": false
  },
  {
    "id": "A30",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "I enjoy starting conversations with people I have just met.",
    "context": "Relationships",
    "reverse": false
  },
  {
    "id": "A31",
    "kind": "agreement",
    "style": "shepherd",
    "text": "I naturally check on people who may be carrying hidden burdens.",
    "context": "Relationships",
    "reverse": false
  },
  {
    "id": "A32",
    "kind": "agreement",
    "style": "steward",
    "text": "I value clear processes that can be repeated by others.",
    "context": "Church multiplication",
    "reverse": false
  },
  {
    "id": "A33",
    "kind": "agreement",
    "style": "pioneer",
    "text": "I enjoy leading the first phase of a new initiative.",
    "context": "Church multiplication",
    "reverse": false
  },
  {
    "id": "A34",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "I look for words and stories that help others see possibilities.",
    "context": "Communication",
    "reverse": false
  },
  {
    "id": "A35",
    "kind": "agreement",
    "style": "shepherd",
    "text": "I am willing to adjust the pace of a project to support the team.",
    "context": "Team dynamics",
    "reverse": false
  },
  {
    "id": "A36",
    "kind": "agreement",
    "style": "steward",
    "text": "I prefer following through carefully rather than leaving loose ends.",
    "context": "Execution",
    "reverse": false
  },
  {
    "id": "A37",
    "kind": "agreement",
    "style": "pioneer",
    "text": "I am willing to make a timely decision that others may question.",
    "context": "Pressure",
    "reverse": false
  },
  {
    "id": "A38",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "I enjoy helping volunteers see why their contribution matters.",
    "context": "Team dynamics",
    "reverse": false
  },
  {
    "id": "A39",
    "kind": "agreement",
    "style": "shepherd",
    "text": "I enjoy helping people experience belonging in a new community.",
    "context": "Church multiplication",
    "reverse": false
  },
  {
    "id": "A40",
    "kind": "agreement",
    "style": "steward",
    "text": "When a problem arises, I look for its underlying causes.",
    "context": "Pressure",
    "reverse": false
  },
  {
    "id": "A41",
    "kind": "agreement",
    "style": "pioneer",
    "text": "I prefer to postpone a decision until everyone is fully comfortable.",
    "context": "Decision-making",
    "reverse": true
  },
  {
    "id": "A42",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "I would rather refine a detailed plan privately than discuss it with others.",
    "context": "Communication",
    "reverse": true
  },
  {
    "id": "A43",
    "kind": "agreement",
    "style": "shepherd",
    "text": "I can move on after a disagreement even when people have not felt heard.",
    "context": "Conflict",
    "reverse": true
  },
  {
    "id": "A44",
    "kind": "agreement",
    "style": "steward",
    "text": "I usually prefer improvising roles instead of defining them before a project begins.",
    "context": "Team dynamics",
    "reverse": true
  },
  {
    "id": "A45",
    "kind": "agreement",
    "style": "pioneer",
    "text": "When the path is unclear, I usually wait for someone else to take initiative.",
    "context": "Initiative",
    "reverse": true
  },
  {
    "id": "A46",
    "kind": "agreement",
    "style": "mobilizer",
    "text": "When a team loses momentum, I rarely try to lift its energy.",
    "context": "Pressure",
    "reverse": true
  },
  {
    "id": "A47",
    "kind": "agreement",
    "style": "shepherd",
    "text": "I seldom notice when a quieter person is uncomfortable in a group.",
    "context": "Relationships",
    "reverse": true
  },
  {
    "id": "A48",
    "kind": "agreement",
    "style": "steward",
    "text": "I am comfortable leaving important details unresolved once an idea has launched.",
    "context": "Execution",
    "reverse": true
  },
  {
    "id": "E01",
    "kind": "ease",
    "style": "pioneer",
    "text": "Making a timely decision without having every detail",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E02",
    "kind": "ease",
    "style": "mobilizer",
    "text": "Explaining a ministry vision in a way that invites participation",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E03",
    "kind": "ease",
    "style": "shepherd",
    "text": "Noticing and engaging someone who may feel overlooked",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E04",
    "kind": "ease",
    "style": "steward",
    "text": "Turning a broad ministry idea into clear sequenced tasks",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E05",
    "kind": "ease",
    "style": "pioneer",
    "text": "Addressing a difficult issue directly and respectfully",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E06",
    "kind": "ease",
    "style": "mobilizer",
    "text": "Starting a purposeful conversation with someone new",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E07",
    "kind": "ease",
    "style": "shepherd",
    "text": "Helping a person process a difficult change",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E08",
    "kind": "ease",
    "style": "steward",
    "text": "Identifying foreseeable risks before a new launch",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E09",
    "kind": "ease",
    "style": "pioneer",
    "text": "Beginning a small ministry experiment before every step is settled",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E10",
    "kind": "ease",
    "style": "mobilizer",
    "text": "Encouraging a team that has lost momentum",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E11",
    "kind": "ease",
    "style": "shepherd",
    "text": "Listening well when someone shares disappointment",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E12",
    "kind": "ease",
    "style": "steward",
    "text": "Defining roles and responsibilities for volunteers",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E13",
    "kind": "ease",
    "style": "pioneer",
    "text": "Asking a team to commit to an ambitious but realistic goal",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E14",
    "kind": "ease",
    "style": "mobilizer",
    "text": "Inviting people to take ownership of a shared goal",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E15",
    "kind": "ease",
    "style": "shepherd",
    "text": "Helping people rebuild trust after relational tension",
    "context": "Ministry practices",
    "reverse": false
  },
  {
    "id": "E16",
    "kind": "ease",
    "style": "steward",
    "text": "Following through on important details during a complex project",
    "context": "Ministry practices",
    "reverse": false
  }
];
  const VERSION=2;
  return Object.freeze({VERSION,STYLES:Object.freeze(STYLES),ITEMS:Object.freeze(ITEMS.map(item=>Object.freeze(item)))});
});
