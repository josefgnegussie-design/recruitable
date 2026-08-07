-- Valfritt telefonnummer på förfrågningsformuläret, för besökare som kryssar
-- i "Jag vill bli uppringd snarast möjligt". Samma sekretessnivå som namn/
-- e-post/roll — döljs för bolaget tills det accepterat förfrågan (se
-- lib/inquiries.js).
alter table inquiries
  add column if not exists requester_phone text;
