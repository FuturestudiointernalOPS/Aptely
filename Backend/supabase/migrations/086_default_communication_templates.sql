-- 086_default_communication_templates.sql
-- Seeds default global communication templates (institution_id = NULL = available to all)

INSERT INTO communication_templates (institution_id, type, title, subject_template, body_template, channel, is_active)
VALUES
  (NULL, 'DECISION_REJECT', 'Refus standard',
   'Votre candidature pour {{role_title}}',
   E'Bonjour {{candidate_name}},\n\nMerci de l''intérêt que vous portez au poste de {{role_title}} chez {{institution_name}}.\n\nAprès examen attentif de votre candidature, nous avons décidé de ne pas donner suite à votre dossier. Cette décision ne reflète en rien vos qualités personnelles, mais résulte de critères spécifiques au profil recherché.\n\nNous vous souhaitons le meilleur pour la suite de votre parcours professionnel.\n\nCordialement,\nL''équipe {{institution_name}}',
   'EMAIL', true),

  (NULL, 'DECISION_REJECT', 'Refus avec feedback',
   'Retour sur votre candidature — {{role_title}}',
   E'Bonjour {{candidate_name}},\n\nNous vous remercions pour le temps consacré au processus de recrutement pour le poste de {{role_title}} chez {{institution_name}}.\n\nAprès délibération, nous n''avons pas retenu votre candidature. Le profil recherché nécessitait davantage d''expérience sur certains aspects techniques spécifiques au poste.\n\nVotre profil est néanmoins intéressant et nous vous encourageons à postuler à nouveau lors de prochaines opportunités.\n\nCordialement,\nL''équipe {{institution_name}}',
   'EMAIL', true),

  (NULL, 'DECISION_HOLD', 'Candidature en attente',
   'Mise en attente — {{role_title}}',
   E'Bonjour {{candidate_name}},\n\nMerci pour votre candidature au poste de {{role_title}} chez {{institution_name}}.\n\nNous avons décidé de conserver votre dossier en attente pendant que nous finalisons notre processus de sélection. Nous reviendrons vers vous prochainement.\n\nCordialement,\nL''équipe {{institution_name}}',
   'EMAIL', true),

  (NULL, 'DECISION_HOLD', 'Liste d''attente',
   'Votre candidature — {{role_title}} (liste d''attente)',
   E'Bonjour {{candidate_name}},\n\nSuite à l''étude approfondie de votre dossier pour le poste de {{role_title}} chez {{institution_name}}, nous avons le plaisir de vous informer que vous êtes placé(e) sur notre liste d''attente prioritaire.\n\nSi un poste se libère ou si nos besoins évoluent, vous serez contacté(e) en priorité.\n\nCordialement,\nL''équipe {{institution_name}}',
   'EMAIL', true),

  (NULL, 'DECISION_ACCEPT', 'Acceptation candidature',
   'Bonne nouvelle — votre candidature pour {{role_title}}',
   E'Bonjour {{candidate_name}},\n\nNous avons le plaisir de vous informer que votre candidature au poste de {{role_title}} chez {{institution_name}} a été retenue à l''issue de notre processus de sélection.\n\nNous allons vous contacter très prochainement pour vous communiquer les prochaines étapes.\n\nFélicitations et bienvenue dans l''aventure !\n\nCordialement,\nL''équipe {{institution_name}}',
   'EMAIL', true)

ON CONFLICT DO NOTHING;
